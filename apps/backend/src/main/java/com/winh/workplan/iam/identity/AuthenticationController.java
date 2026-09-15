package com.winh.workplan.iam.identity;

import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthenticationController {

	private final IdentitySessionService identitySessionService;
	private final SessionCookieWriter sessionCookieWriter;

	AuthenticationController(
			IdentitySessionService identitySessionService,
			SessionCookieWriter sessionCookieWriter) {
		this.identitySessionService = identitySessionService;
		this.sessionCookieWriter = sessionCookieWriter;
	}

	@GetMapping("/csrf")
	public Map<String, String> csrf(CsrfToken csrfToken) {
		return Map.of("token", csrfToken.getToken());
	}

	@PostMapping("/login")
	public ResponseEntity<CurrentSessionResponse> login(
			@Valid @RequestBody LoginRequest request,
			HttpServletResponse response) {
		IdentitySessionService.AuthenticatedSession authenticatedSession = identitySessionService.authenticate(
				request.loginName(),
				request.password());
		sessionCookieWriter.write(response, authenticatedSession.rawToken());
		return ResponseEntity.ok(CurrentSessionResponse.from(authenticatedSession.principal()));
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
		identitySessionService.logout(sessionCookieWriter.read(request));
		sessionCookieWriter.clear(response);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/me")
	public CurrentSessionResponse currentSession(Authentication authentication) {
		return CurrentSessionResponse.from(requirePrincipal(authentication));
	}

	@PostMapping("/password/change")
	public ResponseEntity<CurrentSessionResponse> changePassword(
			@Valid @RequestBody ChangePasswordRequest request,
			Authentication authentication,
			HttpServletResponse response) {
		IdentitySessionService.AuthenticatedSession authenticatedSession = identitySessionService.changePassword(
				requirePrincipal(authentication),
				request.currentPassword(),
				request.newPassword());
		sessionCookieWriter.write(response, authenticatedSession.rawToken());
		return ResponseEntity.status(HttpStatus.OK).body(CurrentSessionResponse.from(authenticatedSession.principal()));
	}

	private SessionPrincipal requirePrincipal(Authentication authentication) {
		if (authentication == null || !(authentication.getPrincipal() instanceof SessionPrincipal principal)) {
			throw new org.springframework.security.authentication.AuthenticationCredentialsNotFoundException("需要有效会话。");
		}
		return principal;
	}

	public record LoginRequest(
			@NotBlank(message = "请输入登录账号。") String loginName,
			@NotBlank(message = "请输入密码。") String password) {
	}

	public record ChangePasswordRequest(
			@NotBlank(message = "请输入当前密码。") String currentPassword,
			@NotBlank(message = "请输入新密码。") @Size(min = 12, message = "新密码至少需要 12 位。") String newPassword) {
	}
}
