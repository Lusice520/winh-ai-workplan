package com.winh.workplan.iam.identity;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.winh.workplan.iam.account.AccountStatus;
import com.winh.workplan.iam.account.UserAccount;
import com.winh.workplan.iam.account.UserAccountRepository;
import com.winh.workplan.iam.audit.AuditEventCommand;
import com.winh.workplan.iam.audit.AuditOutcome;
import com.winh.workplan.iam.audit.AuditRecorder;
import com.winh.workplan.iam.shared.CorrelationIdHolder;
import com.winh.workplan.iam.shared.DomainException;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentitySessionService implements SessionRevoker {

	private static final SecureRandom SECURE_RANDOM = new SecureRandom();

	private final UserAccountRepository userAccountRepository;
	private final AccountSessionRepository accountSessionRepository;
	private final PasswordPolicy passwordPolicy;
	private final SessionProperties sessionProperties;
	private final AuditRecorder auditRecorder;

	IdentitySessionService(
			UserAccountRepository userAccountRepository,
			AccountSessionRepository accountSessionRepository,
			PasswordPolicy passwordPolicy,
			SessionProperties sessionProperties,
			AuditRecorder auditRecorder) {
		this.userAccountRepository = userAccountRepository;
		this.accountSessionRepository = accountSessionRepository;
		this.passwordPolicy = passwordPolicy;
		this.sessionProperties = sessionProperties;
		this.auditRecorder = auditRecorder;
	}

	@Transactional(noRollbackFor = DomainException.class)
	public AuthenticatedSession authenticate(String loginName, String password) {
		String normalizedLoginName = normalizeLoginName(loginName);
		Optional<UserAccount> account = userAccountRepository.findByLoginNameNormalized(normalizedLoginName);
		if (account.isEmpty()) {
			recordLoginFailure(null, "UNKNOWN_ACCOUNT");
			throw authenticationFailed();
		}

		UserAccount currentAccount = account.get();
		Instant now = Instant.now();
		if (currentAccount.getAccountStatus() == AccountStatus.LOCKED
				&& currentAccount.getLockedUntil() != null
				&& !currentAccount.getLockedUntil().isAfter(now)) {
			currentAccount.unlockAfterExpiry();
			auditRecorder.record(new AuditEventCommand(
					"ACCOUNT_AUTO_UNLOCKED",
					currentAccount.getId(),
					"USER_ACCOUNT",
					currentAccount.getId(),
					AuditOutcome.SUCCEEDED,
					CorrelationIdHolder.currentOrCreate(),
					"登录锁定已到期。",
					"LOCKED",
					"ENABLED"));
		}

		if (currentAccount.getAccountStatus() != AccountStatus.ENABLED
				|| !passwordPolicy.matches(password, currentAccount.getPasswordHash())) {
			if (currentAccount.getAccountStatus() == AccountStatus.ENABLED) {
				applyFailedLogin(currentAccount, now);
			}
			recordLoginFailure(currentAccount.getId(), "CREDENTIAL_OR_STATUS_REJECTED");
			throw authenticationFailed();
		}

		currentAccount.recordSuccessfulLogin(now);
		AuthenticatedSession authenticatedSession = createSession(currentAccount);
		auditRecorder.record(new AuditEventCommand(
				"AUTH_LOGIN_SUCCEEDED",
				currentAccount.getId(),
				"USER_ACCOUNT",
				currentAccount.getId(),
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				null,
				null,
				"会话已创建"));
		return authenticatedSession;
	}

	@Transactional
	public Optional<SessionPrincipal> resolve(String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			return Optional.empty();
		}

		return accountSessionRepository.findByTokenHash(hashToken(rawToken))
				.filter(session -> session.isActiveAt(Instant.now()))
				.filter(session -> session.getAccount().getAccountStatus() == AccountStatus.ENABLED)
				.map(session -> {
					Instant now = Instant.now();
					session.touch(now, sessionProperties.getIdleMinutes());
					UserAccount account = session.getAccount();
					return new SessionPrincipal(
							account.getId(),
							account.getLoginName(),
							account.getDisplayName(),
							account.isBootstrapSystemAdministrator(),
							account.isMustChangePassword(),
							session.getId());
				});
	}

	@Transactional
	public void logout(String rawToken) {
		if (rawToken == null || rawToken.isBlank()) {
			return;
		}
		accountSessionRepository.findByTokenHash(hashToken(rawToken)).ifPresent(session -> session.revoke("LOGOUT"));
	}

	@Transactional
	public AuthenticatedSession changePassword(
			SessionPrincipal principal,
			String currentPassword,
			String newPassword) {
		UserAccount account = userAccountRepository.findById(principal.accountId())
				.orElseThrow(this::authenticationFailed);
		if (!passwordPolicy.matches(currentPassword, account.getPasswordHash())) {
			throw new DomainException(
					HttpStatus.BAD_REQUEST,
					"VALIDATION_FAILED",
					"请检查输入后重试。",
					List.of(new com.winh.workplan.iam.shared.ApiProblem.FieldProblem("currentPassword", "当前密码不正确。")));
		}

		account.replacePassword(passwordPolicy.hash(newPassword), false);
		revokeSessionsForAccount(account.getId(), "PASSWORD_CHANGED");
		AuthenticatedSession newSession = createSession(account);
		auditRecorder.record(new AuditEventCommand(
				"AUTH_PASSWORD_CHANGED",
				account.getId(),
				"USER_ACCOUNT",
				account.getId(),
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				null,
				"mustChangePassword=true",
				"mustChangePassword=false"));
		return newSession;
	}

	@Override
	@Transactional
	public void revokeSessionsForAccount(UUID accountId, String reason) {
		accountSessionRepository.findByAccountIdAndRevokedAtIsNull(accountId)
				.forEach(session -> session.revoke(reason));
		auditRecorder.record(new AuditEventCommand(
				"ACCOUNT_SESSIONS_REVOKED",
				null,
				"USER_ACCOUNT",
				accountId,
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				reason,
				null,
				null));
	}

	private void applyFailedLogin(UserAccount account, Instant now) {
		if (account.getLastFailedLoginAt() != null
				&& account.getLastFailedLoginAt().plusSeconds(sessionProperties.getLockMinutes() * 60L).isBefore(now)) {
			account.resetFailedLoginAttempts();
		}
		int nextFailureCount = account.getFailedLoginCount() + 1;
		Instant lockUntil = nextFailureCount >= sessionProperties.getFailedLoginLimit()
				? now.plusSeconds(sessionProperties.getLockMinutes() * 60L)
				: null;
		account.recordFailedLogin(now, lockUntil);
	}

	private AuthenticatedSession createSession(UserAccount account) {
		Instant now = Instant.now();
		String rawToken = generateRawToken();
		AccountSession session = accountSessionRepository.save(new AccountSession(
				account,
				hashToken(rawToken),
				now.plusSeconds(sessionProperties.getAbsoluteHours() * 3_600L),
				now.plusSeconds(sessionProperties.getIdleMinutes() * 60L)));
		SessionPrincipal principal = new SessionPrincipal(
				account.getId(),
				account.getLoginName(),
				account.getDisplayName(),
				account.isBootstrapSystemAdministrator(),
				account.isMustChangePassword(),
				session.getId());
		return new AuthenticatedSession(principal, rawToken);
	}

	private void recordLoginFailure(UUID accountId, String reason) {
		auditRecorder.record(new AuditEventCommand(
				"AUTH_LOGIN_FAILED",
				accountId,
				"USER_ACCOUNT",
				accountId,
				AuditOutcome.DENIED,
				CorrelationIdHolder.currentOrCreate(),
				reason,
				null,
				null));
	}

	private DomainException authenticationFailed() {
		return new DomainException(
				HttpStatus.UNAUTHORIZED,
				"AUTHENTICATION_FAILED",
				"账号或凭证无效，请重试或联系管理员。");
	}

	private String normalizeLoginName(String loginName) {
		return loginName == null ? "" : loginName.trim().toLowerCase(java.util.Locale.ROOT);
	}

	private String generateRawToken() {
		byte[] randomBytes = new byte[32];
		SECURE_RANDOM.nextBytes(randomBytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
	}

	private String hashToken(String rawToken) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
					.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("当前 JDK 不支持 SHA-256。", exception);
		}
	}

	public record AuthenticatedSession(SessionPrincipal principal, String rawToken) {
	}
}
