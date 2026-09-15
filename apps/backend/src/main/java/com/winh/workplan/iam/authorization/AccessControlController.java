package com.winh.workplan.iam.authorization;

import static com.winh.workplan.iam.authorization.AccessControlResponses.AccessRoleResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.MenuResourceImpactResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.MenuResourceResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.PermissionItemResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.PermissionPreviewResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.RoleImpactResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.SystemRoleAssignmentResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.SystemRoleAssignmentSetResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.TemporaryGrantResponse;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.menu.MenuResourceStatus;
import com.winh.workplan.iam.menu.MenuResourceType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP adapter for the formal access-control workspace. Authorization is
 * enforced before this controller by AccessControlAuthorizationFilter; this
 * class never infers access from an incoming menu, route, or client role.
 */
@RestController
@RequestMapping("/api/access-control")
public class AccessControlController {

	private final AccessControlAdministrationService accessControlAdministrationService;

	AccessControlController(AccessControlAdministrationService accessControlAdministrationService) {
		this.accessControlAdministrationService = accessControlAdministrationService;
	}

	@GetMapping("/navigation")
	public List<NavigationItem> navigation(Authentication authentication) {
		return accessControlAdministrationService.listNavigation(principal(authentication));
	}

	@GetMapping("/menu-resources")
	public List<MenuResourceResponse> listMenuResources() {
		return accessControlAdministrationService.listMenuResources();
	}

	@GetMapping("/capabilities")
	public List<String> capabilities(Authentication authentication) {
		return accessControlAdministrationService.capabilities(principal(authentication));
	}

	@PostMapping("/menu-resources")
	public ResponseEntity<MenuResourceResponse> createMenuResource(
			@Valid @RequestBody CreateMenuResourceRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return ResponseEntity.status(201).body(accessControlAdministrationService.createMenuResource(
				new AccessControlAdministrationService.CreateMenuResourceCommand(
						request.code(),
						request.resourceType(),
						request.parentId(),
						request.name(),
						request.routeKey(),
						request.actionKey(),
						request.iconKey(),
						request.sortOrder(),
						request.status()),
				idempotencyKey,
				principal(authentication).accountId()));
	}

	@PatchMapping("/menu-resources/{resourceId}")
	public MenuResourceResponse updateMenuResource(
			@PathVariable UUID resourceId,
			@Valid @RequestBody UpdateMenuResourceRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return accessControlAdministrationService.updateMenuResource(
				resourceId,
				new AccessControlAdministrationService.UpdateMenuResourceCommand(
						request.name(),
						request.routeKey(),
						request.actionKey(),
						request.iconKey(),
						request.sortOrder(),
						request.version()),
				idempotencyKey,
				principal(authentication).accountId());
	}

	@PostMapping("/menu-resources/{resourceId}/move")
	public MenuResourceResponse moveMenuResource(
			@PathVariable UUID resourceId,
			@Valid @RequestBody MoveMenuResourceRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return accessControlAdministrationService.moveMenuResource(
				resourceId,
				new AccessControlAdministrationService.MoveMenuResourceCommand(
						request.parentId(),
						request.reason(),
						request.version()),
				idempotencyKey,
				principal(authentication).accountId());
	}

	@PostMapping("/menu-resources/{resourceId}/status")
	public MenuResourceResponse changeMenuResourceStatus(
			@PathVariable UUID resourceId,
			@Valid @RequestBody MenuResourceStatusRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return accessControlAdministrationService.changeMenuResourceStatus(
				resourceId,
				new AccessControlAdministrationService.MenuResourceStatusCommand(
						request.status(),
						request.reason(),
						request.version()),
				idempotencyKey,
				principal(authentication).accountId());
	}

	@GetMapping("/menu-resources/{resourceId}/impact")
	public MenuResourceImpactResponse menuResourceImpact(@PathVariable UUID resourceId) {
		return accessControlAdministrationService.getMenuResourceImpact(resourceId);
	}

	@GetMapping("/permission-items")
	public List<PermissionItemResponse> listPermissionItems() {
		return accessControlAdministrationService.listPermissionItems();
	}

	@GetMapping("/permission-items/{code}")
	public PermissionItemResponse getPermissionItem(@PathVariable String code) {
		return accessControlAdministrationService.getPermissionItem(code);
	}

	@GetMapping("/roles")
	public List<AccessRoleResponse> listRoles(
			@RequestParam(required = false) AccessRoleType roleType,
			@RequestParam(required = false) AccessRoleStatus status,
			@RequestParam(required = false) String keyword) {
		return accessControlAdministrationService.listRoles(roleType, status, keyword);
	}

	@GetMapping("/roles/{roleId}")
	public AccessRoleResponse getRole(@PathVariable UUID roleId) {
		return accessControlAdministrationService.getRole(roleId);
	}

	@PostMapping("/roles")
	public ResponseEntity<AccessRoleResponse> createRole(
			@Valid @RequestBody CreateRoleRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return ResponseEntity.status(201).body(accessControlAdministrationService.createRole(
				new AccessControlAdministrationService.CreateRoleCommand(
						request.code(),
						request.name(),
						request.roleType(),
						request.responsibilitySummary(),
						request.status(),
						request.delegationLevel(),
						toGrantCommands(request.grants())),
				principal(authentication),
				idempotencyKey));
	}

	@PatchMapping("/roles/{roleId}")
	public AccessRoleResponse updateRole(
			@PathVariable UUID roleId,
			@Valid @RequestBody UpdateRoleRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return accessControlAdministrationService.updateRole(
				roleId,
				new AccessControlAdministrationService.UpdateRoleCommand(
						request.name(),
						request.responsibilitySummary(),
						request.delegationLevel(),
						request.version(),
						toGrantCommands(request.grants())),
				principal(authentication),
				idempotencyKey);
	}

	@PostMapping("/roles/{roleId}/status")
	public AccessRoleResponse changeRoleStatus(
			@PathVariable UUID roleId,
			@Valid @RequestBody RoleStatusRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return accessControlAdministrationService.changeRoleStatus(
				roleId,
				new AccessControlAdministrationService.RoleStatusCommand(
						request.status(),
						request.reason(),
						request.version()),
				principal(authentication),
				idempotencyKey);
	}

	@GetMapping("/roles/{roleId}/impact")
	public RoleImpactResponse roleImpact(@PathVariable UUID roleId) {
		return accessControlAdministrationService.getRoleImpact(roleId);
	}

	@GetMapping("/system-role-assignments")
	public List<SystemRoleAssignmentResponse> listSystemRoleAssignments(
			@RequestParam(required = false) UUID accountId) {
		return accessControlAdministrationService.listSystemRoleAssignments(accountId);
	}

	@GetMapping("/accounts/{accountId}/system-role-assignments")
	public SystemRoleAssignmentSetResponse getSystemRoleAssignments(@PathVariable UUID accountId) {
		return accessControlAdministrationService.getSystemRoleAssignments(accountId);
	}

	@PutMapping("/accounts/{accountId}/system-role-assignments")
	public SystemRoleAssignmentSetResponse replaceSystemRoleAssignments(
			@PathVariable UUID accountId,
			@Valid @RequestBody ReplaceSystemRoleAssignmentsRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return accessControlAdministrationService.replaceSystemRoleAssignments(
				accountId,
				new AccessControlAdministrationService.ReplaceSystemRoleAssignmentsCommand(
						request.roleIds(),
						request.version(),
						request.reason()),
				principal(authentication),
				idempotencyKey);
	}

	@GetMapping("/temporary-grants")
	public List<TemporaryGrantResponse> listTemporaryGrants(
			@RequestParam(required = false) UUID recipientAccountId,
			@RequestParam(required = false) TemporaryGrantStatus status,
			Authentication authentication) {
		return accessControlAdministrationService.listTemporaryGrants(recipientAccountId, status,principal(authentication));
	}

	@PostMapping("/temporary-grants/{grantId}/review")
	public TemporaryGrantResponse reviewTemporaryGrant(@PathVariable UUID grantId,
		@Valid @RequestBody ReviewTemporaryGrantRequest request,
		@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,Authentication authentication) {
		return accessControlAdministrationService.reviewTemporaryGrant(grantId,
			new AccessControlAdministrationService.ReviewTemporaryGrantCommand(request.decision(),request.comment(),request.version()),
			principal(authentication),idempotencyKey);
	}

	@PostMapping("/temporary-grants")
	public ResponseEntity<TemporaryGrantResponse> createTemporaryGrant(
			@Valid @RequestBody CreateTemporaryGrantRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return ResponseEntity.status(201).body(accessControlAdministrationService.createTemporaryGrant(
				new AccessControlAdministrationService.CreateTemporaryGrantCommand(
						request.recipientAccountId(),
						request.permissionCode(),
						request.dataScope(),
						request.scopeReferences(),
						request.startsAt(),
						request.endsAt(),
						request.reason(),
						request.reviewerAccountId()),
				principal(authentication),
				idempotencyKey));
	}

	@PostMapping("/temporary-grants/{grantId}/revoke")
	public TemporaryGrantResponse revokeTemporaryGrant(
			@PathVariable UUID grantId,
			@Valid @RequestBody RevokeTemporaryGrantRequest request,
			@RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
			Authentication authentication) {
		return accessControlAdministrationService.revokeTemporaryGrant(
				grantId,
				new AccessControlAdministrationService.RevokeTemporaryGrantCommand(
						request.reason(),
						request.version()),
				principal(authentication),
				idempotencyKey);
	}

	@PostMapping("/permission-preview")
	public PermissionPreviewResponse permissionPreview(
			@Valid @RequestBody PermissionPreviewRequest request,
			Authentication authentication) {
		return accessControlAdministrationService.previewPermission(
				new AccessControlAdministrationService.PermissionPreviewCommand(
						request.subjectAccountId(),
						request.permissionCode(),
						request.organizationUnitId(),
						request.projectId(),
						request.objectReference(),
						Boolean.TRUE.equals(request.participatingProject()),
						request.resourceEnabled() == null || request.resourceEnabled(),
						request.recordStateAllowed() == null || request.recordStateAllowed(),
						request.sensitiveConditionsMet() == null || request.sensitiveConditionsMet()),
				principal(authentication));
	}

	private List<AccessControlAdministrationService.RolePermissionGrantCommand> toGrantCommands(
			List<RolePermissionGrantRequest> grants) {
		if (grants == null) {
			return List.of();
		}
		return grants.stream()
				.map(grant -> new AccessControlAdministrationService.RolePermissionGrantCommand(
						grant.permissionCode(),
						grant.dataScope(),
						grant.scopeReferences(),
						grant.conditionSummary()))
				.toList();
	}

	private SessionPrincipal principal(Authentication authentication) {
		return (SessionPrincipal) authentication.getPrincipal();
	}

	public record CreateMenuResourceRequest(
			@NotBlank String code,
			@NotNull MenuResourceType resourceType,
			UUID parentId,
			@NotBlank String name,
			String routeKey,
			String actionKey,
			String iconKey,
			int sortOrder,
			MenuResourceStatus status) {
	}

	public record UpdateMenuResourceRequest(
			@NotBlank String name,
			String routeKey,
			String actionKey,
			String iconKey,
			int sortOrder,
			@PositiveOrZero long version) {
	}

	public record MoveMenuResourceRequest(
			UUID parentId,
			@NotBlank String reason,
			@PositiveOrZero long version) {
	}

	public record MenuResourceStatusRequest(
			@NotNull MenuResourceStatus status,
			@NotBlank String reason,
			@PositiveOrZero long version) {
	}

	public record RolePermissionGrantRequest(
			@NotBlank String permissionCode,
			@NotNull DataScope dataScope,
			String scopeReferences,
			String conditionSummary) {
	}

	public record CreateRoleRequest(
			@NotBlank String code,
			@NotBlank String name,
			@NotNull AccessRoleType roleType,
			@NotBlank String responsibilitySummary,
			AccessRoleStatus status,
			@NotNull Integer delegationLevel,
			@Valid List<RolePermissionGrantRequest> grants) {
	}

	public record UpdateRoleRequest(
			@NotBlank String name,
			@NotBlank String responsibilitySummary,
			@NotNull Integer delegationLevel,
			@PositiveOrZero long version,
			@Valid List<RolePermissionGrantRequest> grants) {
	}

	public record RoleStatusRequest(
			@NotNull AccessRoleStatus status,
			@NotBlank String reason,
			@PositiveOrZero long version) {
	}

	public record ReplaceSystemRoleAssignmentsRequest(
			Set<UUID> roleIds,
			@PositiveOrZero long version,
			@NotBlank String reason) {
	}

	public record CreateTemporaryGrantRequest(
			@NotNull UUID recipientAccountId,
			@NotBlank String permissionCode,
			@NotNull DataScope dataScope,
			String scopeReferences,
			@NotNull Instant startsAt,
			@NotNull Instant endsAt,
			@NotBlank String reason,
			UUID reviewerAccountId) {
	}

	public record RevokeTemporaryGrantRequest(
			@NotBlank String reason,
			@PositiveOrZero long version) {
	}

	public record ReviewTemporaryGrantRequest(@NotBlank String decision,@NotBlank String comment,@PositiveOrZero long version) {}

	public record PermissionPreviewRequest(
			@NotNull UUID subjectAccountId,
			@NotBlank String permissionCode,
			UUID organizationUnitId,
			UUID projectId,
			String objectReference,
			Boolean participatingProject,
			Boolean resourceEnabled,
			Boolean recordStateAllowed,
			Boolean sensitiveConditionsMet) {
	}
}
