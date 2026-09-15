package com.winh.workplan.iam.account;

import java.util.Collections;
import java.util.Set;
import java.util.UUID;

import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.PageResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/iam/users")
public class UserAccountController {

	private final AccountAdministrationService accountAdministrationService;

	UserAccountController(AccountAdministrationService accountAdministrationService) {
		this.accountAdministrationService = accountAdministrationService;
	}

	@GetMapping
	public PageResponse<UserAccountResponse> queryUsers(
			@RequestParam(defaultValue = "1") int page,
			@RequestParam(defaultValue = "10") int pageSize,
			@RequestParam(required = false) String keyword,
			@RequestParam(required = false) UUID organizationUnitId,
			@RequestParam(defaultValue = "true") boolean includeDescendants,
			@RequestParam(required = false) Set<AccountStatus> statuses) {
		return accountAdministrationService.queryUsers(new UserDirectoryQuery(
				page,
				pageSize,
				keyword,
				organizationUnitId,
				includeDescendants,
				statuses == null ? Collections.emptySet() : statuses));
	}

	@PostMapping
	public ResponseEntity<UserAccountResponse> create(
			@Valid @RequestBody CreateUserRequest request,
			Authentication authentication) {
		UserAccountResponse response = accountAdministrationService.createUser(
				new CreateUserCommand(
						request.loginName(),
						request.displayName(),
						request.employeeCode(),
						request.workEmail(),
						request.mobilePhone(),
						request.organizationUnitId(),
						request.temporaryPassword()),
				principal(authentication).accountId());
		return ResponseEntity.status(201).body(response);
	}

	@GetMapping("/{accountId}")
	public UserAccountResponse getUser(@PathVariable UUID accountId) {
		return accountAdministrationService.getUser(accountId);
	}

	@PatchMapping("/{accountId}")
	public UserAccountResponse update(
			@PathVariable UUID accountId,
			@Valid @RequestBody UpdateUserRequest request,
			Authentication authentication) {
		return accountAdministrationService.updateUser(
				accountId,
				new UpdateUserCommand(
						request.displayName(),
						request.employeeCode(),
						request.workEmail(),
						request.mobilePhone(),
						request.version()),
				principal(authentication).accountId());
	}

	@PostMapping("/{accountId}/move")
	public UserAccountResponse move(
			@PathVariable UUID accountId,
			@Valid @RequestBody MoveUserRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return accountAdministrationService.moveUser(
				accountId,
				new MoveUserCommand(request.targetOrganizationUnitId(), request.reason(), request.version()),
				idempotencyKey,
				principal(authentication).accountId());
	}

	@PostMapping("/{accountId}/status-transitions")
	public UserAccountResponse transitionStatus(
			@PathVariable UUID accountId,
			@Valid @RequestBody AccountStatusTransitionRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return accountAdministrationService.transitionStatus(
				accountId,
				new AccountStatusTransitionCommand(request.targetStatus(), request.reason(), request.version()),
				idempotencyKey,
				principal(authentication).accountId());
	}

	@PostMapping("/{accountId}/password-resets")
	public UserAccountResponse resetPassword(
			@PathVariable UUID accountId,
			@Valid @RequestBody ResetPasswordRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return accountAdministrationService.resetPassword(
				accountId,
				new ResetPasswordCommand(request.temporaryPassword(), request.reason(), request.version()),
				idempotencyKey,
				principal(authentication).accountId());
	}

	private SessionPrincipal principal(Authentication authentication) {
		return (SessionPrincipal) authentication.getPrincipal();
	}

	public record CreateUserRequest(
			@NotBlank(message = "请输入登录账号。") String loginName,
			@NotBlank(message = "请输入姓名。") String displayName,
			String employeeCode,
			String workEmail,
			String mobilePhone,
			@NotNull(message = "请选择公司或部门。") UUID organizationUnitId,
			@NotBlank(message = "请设置临时密码。") @Size(min = 12, message = "临时密码至少需要 12 位。") String temporaryPassword) {
	}

	public record UpdateUserRequest(
			@NotBlank(message = "请输入姓名。") String displayName,
			String employeeCode,
			String workEmail,
			String mobilePhone,
			@PositiveOrZero(message = "缺少当前版本。") long version) {
	}

	public record MoveUserRequest(
			@NotNull(message = "请选择目标部门。") UUID targetOrganizationUnitId,
			@NotBlank(message = "请填写调动原因。") String reason,
			@PositiveOrZero(message = "缺少当前版本。") long version) {
	}

	public record AccountStatusTransitionRequest(
			@NotNull(message = "请选择账号状态。") AccountStatus targetStatus,
			@NotBlank(message = "请填写变更原因。") String reason,
			@PositiveOrZero(message = "缺少当前版本。") long version) {
	}

	public record ResetPasswordRequest(
			@NotBlank(message = "请设置临时密码。") String temporaryPassword,
			@NotBlank(message = "请填写重置原因。") String reason,
			@PositiveOrZero(message = "缺少当前版本。") long version) {
	}
}
