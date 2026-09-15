package com.winh.workplan.iam.account;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import com.winh.workplan.iam.audit.AuditEventCommand;
import com.winh.workplan.iam.audit.AuditOutcome;
import com.winh.workplan.iam.audit.AuditRecorder;
import com.winh.workplan.iam.identity.PasswordPolicy;
import com.winh.workplan.iam.identity.SessionRevoker;
import com.winh.workplan.iam.organization.OrganizationDirectoryService;
import com.winh.workplan.iam.organization.OrganizationUnit;
import com.winh.workplan.iam.shared.ApiProblem;
import com.winh.workplan.iam.shared.CorrelationIdHolder;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.iam.shared.IdempotencyService;
import com.winh.workplan.iam.shared.PageResponse;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AccountAdministrationService implements AccountDirectory {
    @Override @Transactional
    public void lockForResourceCommit(UUID accountId) {
        var account=userAccountRepository.lockForResourceCommit(accountId)
            .orElseThrow(com.winh.workplan.business.BusinessRules::missing);
        if(account.getAccountStatus()!=AccountStatus.ENABLED)
            throw com.winh.workplan.business.BusinessRules.conflict("资源人员已停用，请重新确认。");
    }

	@Override
	@Transactional(readOnly = true)
	public java.util.List<AccountAuthorizationSnapshot> listActive() {
		return userAccountRepository.findAll().stream()
				.filter(account -> account.getAccountStatus() == AccountStatus.ENABLED)
				.map(account -> new AccountAuthorizationSnapshot(account.getId(), account.getLoginName(),
						account.getDisplayName(), account.getAccountStatus(), account.getOrganizationUnit().getId(),
						account.isBootstrapSystemAdministrator()))
				.toList();
	}

	private final UserAccountRepository userAccountRepository;
	private final AccountOrganizationHistoryRepository accountOrganizationHistoryRepository;
	private final AccountStatusHistoryRepository accountStatusHistoryRepository;
	private final OrganizationDirectoryService organizationDirectoryService;
	private final PasswordPolicy passwordPolicy;
	private final SessionRevoker sessionRevoker;
	private final AuditRecorder auditRecorder;
	private final IdempotencyService idempotencyService;

	AccountAdministrationService(
			UserAccountRepository userAccountRepository,
			AccountOrganizationHistoryRepository accountOrganizationHistoryRepository,
			AccountStatusHistoryRepository accountStatusHistoryRepository,
			OrganizationDirectoryService organizationDirectoryService,
			PasswordPolicy passwordPolicy,
			SessionRevoker sessionRevoker,
			AuditRecorder auditRecorder,
			IdempotencyService idempotencyService) {
		this.userAccountRepository = userAccountRepository;
		this.accountOrganizationHistoryRepository = accountOrganizationHistoryRepository;
		this.accountStatusHistoryRepository = accountStatusHistoryRepository;
		this.organizationDirectoryService = organizationDirectoryService;
		this.passwordPolicy = passwordPolicy;
		this.sessionRevoker = sessionRevoker;
		this.auditRecorder = auditRecorder;
		this.idempotencyService = idempotencyService;
	}

	@Transactional(readOnly = true)
	public PageResponse<UserAccountResponse> queryUsers(UserDirectoryQuery query) {
		int page = Math.max(query.page(), 1);
		int pageSize = Math.min(Math.max(query.pageSize(), 1), 100);
		Specification<UserAccount> specification = buildSpecification(query);
		Page<UserAccount> results = userAccountRepository.findAll(
				specification,
				PageRequest.of(page - 1, pageSize, Sort.by("displayName").ascending().and(Sort.by("loginName").ascending())));
		return PageResponse.from(results, this::toResponse);
	}

	@Transactional(readOnly = true)
	public UserAccountResponse getUser(UUID accountId) {
		return toResponse(requireAccount(accountId));
	}

	@Override
	@Transactional(readOnly = true)
	public java.util.Optional<AccountAuthorizationSnapshot> findAuthorizationSnapshot(UUID accountId) {
		return userAccountRepository.findById(accountId)
				.map(account -> new AccountAuthorizationSnapshot(
						account.getId(),
						account.getLoginName(),
						account.getDisplayName(),
						account.getAccountStatus(),
						account.getOrganizationUnit().getId(),
						account.isBootstrapSystemAdministrator()));
	}

	@Transactional
	public UserAccountResponse createUser(CreateUserCommand command, UUID actorAccountId) {
		String normalizedLoginName = normalizeLoginName(command.loginName());
		if (!StringUtils.hasText(normalizedLoginName)) {
			throw validation("loginName", "请输入登录账号。" );
		}
		if (userAccountRepository.existsByLoginNameNormalized(normalizedLoginName)) {
			throw conflict("DUPLICATE_LOGIN_NAME", "登录账号已存在。", "loginName");
		}
		if (StringUtils.hasText(command.employeeCode()) && userAccountRepository.existsByEmployeeCode(command.employeeCode().trim())) {
			throw conflict("DUPLICATE_EMPLOYEE_CODE", "内部标识已存在。", "employeeCode");
		}
		if (!StringUtils.hasText(command.displayName())) {
			throw validation("displayName", "请输入姓名。" );
		}
		OrganizationUnit organizationUnit = organizationDirectoryService.requireEnabledUnit(command.organizationUnitId());
		UserAccount account = new UserAccount(
				command.loginName().trim(),
				normalizedLoginName,
				command.displayName().trim(),
				trimOrNull(command.employeeCode()),
				trimOrNull(command.workEmail()),
				trimOrNull(command.mobilePhone()),
				organizationUnit,
				passwordPolicy.hash(command.temporaryPassword()),
				true,
				false);
		UserAccount saved = userAccountRepository.saveAndFlush(account);
		accountOrganizationHistoryRepository.save(new AccountOrganizationHistory(
				saved.getId(),
				null,
				organizationUnit.getId(),
				"创建账号时设置初始组织。",
				actorAccountId,
				CorrelationIdHolder.currentOrCreate()));
		accountStatusHistoryRepository.save(new AccountStatusHistory(
				saved.getId(),
				null,
				AccountStatus.ENABLED,
				"创建账号。",
				actorAccountId,
				CorrelationIdHolder.currentOrCreate()));
		auditRecorder.record(new AuditEventCommand(
				"USER_CREATED",
				actorAccountId,
				"USER_ACCOUNT",
				saved.getId(),
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				null,
				null,
				"loginName=" + saved.getLoginName()));
		return toResponse(saved);
	}

	@Transactional
	public UserAccountResponse updateUser(UUID accountId, UpdateUserCommand command, UUID actorAccountId) {
		UserAccount account = requireAccount(accountId);
		validateVersion(account.getVersion(), command.version());
		if (!StringUtils.hasText(command.displayName())) {
			throw validation("displayName", "请输入姓名。" );
		}
		String employeeCode = trimOrNull(command.employeeCode());
		if (employeeCode != null && !employeeCode.equals(account.getEmployeeCode()) && userAccountRepository.existsByEmployeeCode(employeeCode)) {
			throw conflict("DUPLICATE_EMPLOYEE_CODE", "内部标识已存在。", "employeeCode");
		}
		account.updateProfile(
				command.displayName().trim(),
				employeeCode,
				trimOrNull(command.workEmail()),
				trimOrNull(command.mobilePhone()));
		UserAccount saved = userAccountRepository.saveAndFlush(account);
		auditRecorder.record(new AuditEventCommand(
				"USER_UPDATED",
				actorAccountId,
				"USER_ACCOUNT",
				saved.getId(),
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				null,
				null,
				"资料已更新"));
		return toResponse(saved);
	}

	@Transactional
	public UserAccountResponse moveUser(
			UUID accountId,
			MoveUserCommand command,
			String idempotencyKey,
			UUID actorAccountId) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"USER_MOVE",
				idempotencyKey,
				accountId + "|" + command.targetOrganizationUnitId() + "|" + command.reason() + "|" + command.version());
		if (reservation.replayed() && reservation.targetId() != null) {
			return getUser(reservation.targetId());
		}
		UserAccount account = requireAccount(accountId);
		validateVersion(account.getVersion(), command.version());
		OrganizationUnit target = organizationDirectoryService.requireEnabledUnit(command.targetOrganizationUnitId());
		if (account.getOrganizationUnit().getId().equals(target.getId())) {
			idempotencyService.complete(reservation, account.getId());
			return toResponse(account);
		}
		UUID previousOrganizationUnitId = account.getOrganizationUnit().getId();
		account.moveTo(target);
		UserAccount saved = userAccountRepository.saveAndFlush(account);
		accountOrganizationHistoryRepository.save(new AccountOrganizationHistory(
				saved.getId(),
				previousOrganizationUnitId,
				target.getId(),
				requiredReason(command.reason()),
				actorAccountId,
				CorrelationIdHolder.currentOrCreate()));
		idempotencyService.complete(reservation, saved.getId());
		auditRecorder.record(new AuditEventCommand(
				"USER_MOVED",
				actorAccountId,
				"USER_ACCOUNT",
				saved.getId(),
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				command.reason().trim(),
				"organizationUnitId=" + previousOrganizationUnitId,
				"organizationUnitId=" + target.getId()));
		return toResponse(saved);
	}

	@Transactional
	public UserAccountResponse transitionStatus(
			UUID accountId,
			AccountStatusTransitionCommand command,
			String idempotencyKey,
			UUID actorAccountId) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"ACCOUNT_STATUS_TRANSITION",
				idempotencyKey,
				accountId + "|" + command.targetStatus() + "|" + command.reason() + "|" + command.version());
		if (reservation.replayed() && reservation.targetId() != null) {
			return getUser(reservation.targetId());
		}
		UserAccount account = requireAccount(accountId);
		validateVersion(account.getVersion(), command.version());
		AccountStatus targetStatus = command.targetStatus();
		if (targetStatus == null) {
			throw validation("targetStatus", "请选择账号状态。" );
		}
		if (account.isBootstrapSystemAdministrator()
				&& targetStatus != AccountStatus.ENABLED
				&& userAccountRepository.countByBootstrapSystemAdministratorTrueAndAccountStatus(AccountStatus.ENABLED) <= 1) {
			throw new DomainException(
					HttpStatus.CONFLICT,
					"LAST_BOOTSTRAP_ADMIN_PROTECTED",
					"不能处理最后一个初始化系统管理员。" );
		}
		AccountStatus previousStatus = account.getAccountStatus();
		account.changeStatus(targetStatus);
		UserAccount saved = userAccountRepository.saveAndFlush(account);
		accountStatusHistoryRepository.save(new AccountStatusHistory(
				saved.getId(),
				previousStatus,
				targetStatus,
				requiredReason(command.reason()),
				actorAccountId,
				CorrelationIdHolder.currentOrCreate()));
		if (targetStatus != AccountStatus.ENABLED) {
			sessionRevoker.revokeSessionsForAccount(saved.getId(), "ACCOUNT_" + targetStatus.name());
		}
		idempotencyService.complete(reservation, saved.getId());
		auditRecorder.record(new AuditEventCommand(
				"ACCOUNT_STATUS_CHANGED",
				actorAccountId,
				"USER_ACCOUNT",
				saved.getId(),
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				command.reason().trim(),
				previousStatus.name(),
				targetStatus.name()));
		return toResponse(saved);
	}

	@Transactional
	public UserAccountResponse resetPassword(
			UUID accountId,
			ResetPasswordCommand command,
			String idempotencyKey,
			UUID actorAccountId) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"ACCOUNT_PASSWORD_RESET",
				idempotencyKey,
				accountId + "|" + command.version() + "|" + command.reason());
		if (reservation.replayed() && reservation.targetId() != null) {
			return getUser(reservation.targetId());
		}
		UserAccount account = requireAccount(accountId);
		validateVersion(account.getVersion(), command.version());
		account.replacePassword(passwordPolicy.hash(command.temporaryPassword()), true);
		UserAccount saved = userAccountRepository.saveAndFlush(account);
		sessionRevoker.revokeSessionsForAccount(saved.getId(), "PASSWORD_RESET");
		idempotencyService.complete(reservation, saved.getId());
		auditRecorder.record(new AuditEventCommand(
				"ACCOUNT_PASSWORD_RESET",
				actorAccountId,
				"USER_ACCOUNT",
				saved.getId(),
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				requiredReason(command.reason()),
				"password=redacted",
				"mustChangePassword=true"));
		return toResponse(saved);
	}

	private Specification<UserAccount> buildSpecification(UserDirectoryQuery query) {
		return (root, ignoredQuery, builder) -> {
			List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();
			if (query.organizationUnitId() != null) {
				Set<UUID> organizationUnitIds = query.includeDescendants()
						? organizationDirectoryService.withDescendants(query.organizationUnitId())
						: Set.of(query.organizationUnitId());
				predicates.add(root.get("organizationUnit").get("id").in(organizationUnitIds));
			}
			if (query.statuses() != null && !query.statuses().isEmpty()) {
				predicates.add(root.get("accountStatus").in(query.statuses()));
			}
			if (StringUtils.hasText(query.keyword())) {
				String pattern = "%" + query.keyword().trim().toLowerCase(Locale.ROOT) + "%";
				predicates.add(builder.or(
						builder.like(builder.lower(root.get("displayName")), pattern),
						builder.like(builder.lower(root.get("loginName")), pattern),
						builder.like(builder.lower(root.get("employeeCode")), pattern),
						builder.like(builder.lower(root.get("workEmail")), pattern),
						builder.like(builder.lower(root.get("mobilePhone")), pattern)));
			}
			return predicates.isEmpty() ? builder.conjunction() : builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
		};
	}

	private UserAccount requireAccount(UUID accountId) {
		return userAccountRepository.findById(accountId)
				.orElseThrow(() -> new DomainException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "未找到该用户。"));
	}

	private UserAccountResponse toResponse(UserAccount account) {
		OrganizationUnit unit = account.getOrganizationUnit();
		return new UserAccountResponse(
				account.getId(),
				account.getLoginName(),
				account.getDisplayName(),
				account.getEmployeeCode(),
				account.getWorkEmail(),
				account.getMobilePhone(),
				new OrganizationReference(unit.getId(), unit.getName(), unit.getCode()),
				account.getAccountStatus(),
				account.getLastSuccessfulLoginAt(),
				account.isMustChangePassword(),
				account.isBootstrapSystemAdministrator(),
				account.getVersion());
	}

	private String normalizeLoginName(String loginName) {
		return loginName == null ? "" : loginName.trim().toLowerCase(Locale.ROOT);
	}

	private String trimOrNull(String value) {
		return StringUtils.hasText(value) ? value.trim() : null;
	}

	private String requiredReason(String value) {
		if (!StringUtils.hasText(value)) {
			throw validation("reason", "请填写变更原因。" );
		}
		return value.trim();
	}

	private void validateVersion(long actualVersion, long expectedVersion) {
		if (actualVersion != expectedVersion) {
			throw new DomainException(HttpStatus.CONFLICT, "VERSION_CONFLICT", "数据已被其他操作更新，请刷新后重试。" );
		}
	}

	private DomainException validation(String field, String message) {
		return new DomainException(
				HttpStatus.BAD_REQUEST,
				"VALIDATION_FAILED",
				"请检查输入后重试。",
				List.of(new ApiProblem.FieldProblem(field, message)));
	}

	private DomainException conflict(String code, String message, String field) {
		return new DomainException(
				HttpStatus.CONFLICT,
				code,
				message,
				List.of(new ApiProblem.FieldProblem(field, message)));
	}
}
