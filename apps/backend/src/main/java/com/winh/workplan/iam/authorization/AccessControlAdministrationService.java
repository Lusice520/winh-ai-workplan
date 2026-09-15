package com.winh.workplan.iam.authorization;

import static com.winh.workplan.iam.authorization.AccessControlResponses.AccessRoleResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.MenuResourceImpactResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.MenuResourceResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.PermissionItemResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.PermissionPreviewResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.RoleGrantResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.RoleImpactResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.SystemRoleAssignmentResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.SystemRoleAssignmentSetResponse;
import static com.winh.workplan.iam.authorization.AccessControlResponses.TemporaryGrantResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import com.winh.workplan.iam.account.AccountAuthorizationSnapshot;
import com.winh.workplan.iam.account.AccountDirectory;
import com.winh.workplan.iam.account.AccountStatus;
import com.winh.workplan.iam.audit.AuditEventCommand;
import com.winh.workplan.iam.audit.AuditOutcome;
import com.winh.workplan.iam.audit.AuditRecorder;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.menu.MenuResource;
import com.winh.workplan.iam.menu.MenuResourceRepository;
import com.winh.workplan.iam.menu.MenuResourceStatus;
import com.winh.workplan.iam.menu.MenuResourceType;
import com.winh.workplan.iam.shared.ApiProblem;
import com.winh.workplan.iam.shared.CorrelationIdHolder;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.iam.shared.IdempotencyService;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Application service for the formal Menu & Authorization management
 * boundary. The service owns validation, version checks, idempotency and
 * audit; HTTP controllers only translate requests to these commands.
 */
@Service
public class AccessControlAdministrationService {

	private static final String SYSTEM_SECURITY_ADMIN = "SYSTEM_SECURITY_ADMIN";
	private static final Pattern STABLE_CODE = Pattern.compile("[A-Z][A-Z0-9_]{2,119}");
	private static final Duration NORMAL_TEMPORARY_GRANT_LIMIT = Duration.ofDays(7);
	private static final Duration HIGH_RISK_TEMPORARY_GRANT_LIMIT = Duration.ofHours(24);
	private static final Set<DataScope> TEMPORARY_GRANT_SCOPES = Set.of(
			DataScope.SELF,
			DataScope.OWN_ORG,
			DataScope.NAMED_ORG_UNITS,
			DataScope.NAMED_PROJECTS,
			DataScope.NAMED_OBJECTS);

	private final AuthorizationService authorizationService;
	private final AccountDirectory accountDirectory;
	private final MenuResourceRepository menuResourceRepository;
	private final PermissionItemRepository permissionItemRepository;
	private final AccessRoleRepository accessRoleRepository;
	private final RolePermissionGrantRepository rolePermissionGrantRepository;
	private final SystemRoleAssignmentRepository systemRoleAssignmentRepository;
	private final SystemRoleAssignmentSetRepository systemRoleAssignmentSetRepository;
	private final TemporaryGrantRepository temporaryGrantRepository;
	private final IdempotencyService idempotencyService;
	private final AuditRecorder auditRecorder;
	private final ObjectMapper objectMapper;

	AccessControlAdministrationService(
			AuthorizationService authorizationService,
			AccountDirectory accountDirectory,
			MenuResourceRepository menuResourceRepository,
			PermissionItemRepository permissionItemRepository,
			AccessRoleRepository accessRoleRepository,
			RolePermissionGrantRepository rolePermissionGrantRepository,
			SystemRoleAssignmentRepository systemRoleAssignmentRepository,
			SystemRoleAssignmentSetRepository systemRoleAssignmentSetRepository,
			TemporaryGrantRepository temporaryGrantRepository,
			IdempotencyService idempotencyService,
			AuditRecorder auditRecorder, ObjectMapper objectMapper) {
		this.authorizationService = authorizationService;
		this.accountDirectory = accountDirectory;
		this.menuResourceRepository = menuResourceRepository;
		this.permissionItemRepository = permissionItemRepository;
		this.accessRoleRepository = accessRoleRepository;
		this.rolePermissionGrantRepository = rolePermissionGrantRepository;
		this.systemRoleAssignmentRepository = systemRoleAssignmentRepository;
		this.systemRoleAssignmentSetRepository = systemRoleAssignmentSetRepository;
		this.temporaryGrantRepository = temporaryGrantRepository;
		this.idempotencyService = idempotencyService;
		this.auditRecorder = auditRecorder;
		this.objectMapper = objectMapper;
	}

	private String fingerprint(Object command) {
		try { return objectMapper.writeValueAsString(command); }
		catch (JsonProcessingException exception) { throw new IllegalStateException("Cannot fingerprint authorization command", exception); }
	}

	@Transactional(readOnly = true)
	public List<NavigationItem> listNavigation(SessionPrincipal subject) {
		return authorizationService.listNavigation(subject);
	}

	@Transactional(readOnly=true)
	public List<String> capabilities(SessionPrincipal actor) {
		return permissionItemRepository.findAll().stream().filter(p->p.getCode().startsWith("IAM_"))
			.map(PermissionItem::getCode).filter(p->authorizationService.decide(actor,p,ResourceContext.empty()).allowed()).toList();
	}

	@Transactional(readOnly = true)
	public List<MenuResourceResponse> listMenuResources() {
		return menuResourceRepository.findAllByOrderBySortOrderAscNameAsc().stream()
				.map(this::toMenuResourceResponse)
				.toList();
	}

	@Transactional
	public MenuResourceResponse createMenuResource(
			CreateMenuResourceCommand command,
			String idempotencyKey,
			UUID actorAccountId) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"MENU_RESOURCE_CREATE:" + actorAccountId, idempotencyKey, fingerprint(command));
		if (reservation.replayed() && reservation.targetId() != null) {
			return getMenuResource(reservation.targetId());
		}

		String code = normalizeStableCode(command.code(), "code");
		if (menuResourceRepository.findByCode(code).isPresent()) {
			throw conflict("DUPLICATE_MENU_RESOURCE_CODE", "菜单资源编码已存在。", "code");
		}
		MenuResourceType resourceType = required(command.resourceType(), "resourceType", "请选择菜单资源类型。");
		MenuResource parent = resolveMenuParent(resourceType, command.parentId(), null);
		MenuKeys keys = validateMenuKeys(
				resourceType,
				command.routeKey(),
				command.actionKey(),
				command.iconKey());
		String name = requiredText(command.name(), "name", "请输入菜单资源名称。");
		MenuResourceStatus status = command.status() == null ? MenuResourceStatus.ENABLED : command.status();
		MenuResource saved = menuResourceRepository.saveAndFlush(new MenuResource(
				code,
				resourceType,
				parent,
				name,
				keys.routeKey(),
				keys.actionKey(),
				keys.iconKey(),
				command.sortOrder(),
				status));
		idempotencyService.complete(reservation, saved.getId());
		record(
				"MENU_RESOURCE_CREATED",
				actorAccountId,
				"MENU_RESOURCE",
				saved.getId(),
				null,
				"code=" + saved.getCode() + ",type=" + saved.getResourceType() + ",status=" + saved.getStatus());
		return toMenuResourceResponse(saved);
	}

	@Transactional
	public MenuResourceResponse updateMenuResource(
			UUID resourceId,
			UpdateMenuResourceCommand command,
			String idempotencyKey,
			UUID actorAccountId) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"MENU_RESOURCE_UPDATE:" + actorAccountId, idempotencyKey, fingerprint(List.of(resourceId, command)));
		if (reservation.replayed() && reservation.targetId() != null) {
			return getMenuResource(reservation.targetId());
		}

		MenuResource resource = requireMenuResource(resourceId);
		validateVersion(resource.getVersion(), command.version());
		MenuKeys keys = validateMenuKeys(
				resource.getResourceType(),
				command.routeKey(),
				command.actionKey(),
				command.iconKey());
		String before = menuSummary(resource);
		resource.update(
				resource.getParent(),
				requiredText(command.name(), "name", "请输入菜单资源名称。"),
				keys.routeKey(),
				keys.actionKey(),
				keys.iconKey(),
				command.sortOrder());
		MenuResource saved = menuResourceRepository.saveAndFlush(resource);
		idempotencyService.complete(reservation, saved.getId());
		record("MENU_RESOURCE_UPDATED", actorAccountId, "MENU_RESOURCE", saved.getId(), before, menuSummary(saved));
		return toMenuResourceResponse(saved);
	}

	@Transactional
	public MenuResourceResponse moveMenuResource(
			UUID resourceId,
			MoveMenuResourceCommand command,
			String idempotencyKey,
			UUID actorAccountId) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"MENU_RESOURCE_MOVE:" + actorAccountId, idempotencyKey, fingerprint(List.of(resourceId, command)));
		if (reservation.replayed() && reservation.targetId() != null) {
			return getMenuResource(reservation.targetId());
		}

		MenuResource resource = requireMenuResource(resourceId);
		validateVersion(resource.getVersion(), command.version());
		MenuResource parent = resolveMenuParent(resource.getResourceType(), command.parentId(), resource);
		String before = menuSummary(resource);
		resource.update(
				parent,
				resource.getName(),
				resource.getRouteKey(),
				resource.getActionKey(),
				resource.getIconKey(),
				resource.getSortOrder());
		MenuResource saved = menuResourceRepository.saveAndFlush(resource);
		idempotencyService.complete(reservation, saved.getId());
		record(
				"MENU_RESOURCE_MOVED",
				actorAccountId,
				"MENU_RESOURCE",
				saved.getId(),
				before,
				menuSummary(saved),
				requiredText(command.reason(), "reason", "请填写调整原因。"));
		return toMenuResourceResponse(saved);
	}

	@Transactional
	public MenuResourceResponse changeMenuResourceStatus(
			UUID resourceId,
			MenuResourceStatusCommand command,
			String idempotencyKey,
			UUID actorAccountId) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"MENU_RESOURCE_STATUS:" + actorAccountId, idempotencyKey, fingerprint(List.of(resourceId, command)));
		if (reservation.replayed() && reservation.targetId() != null) {
			return getMenuResource(reservation.targetId());
		}

		MenuResource resource = requireMenuResource(resourceId);
		validateVersion(resource.getVersion(), command.version());
		MenuResourceStatus status = required(command.status(), "status", "请选择菜单资源状态。");
		MenuResourceStatus beforeStatus = resource.getStatus();
		resource.changeStatus(status);
		MenuResource saved = menuResourceRepository.saveAndFlush(resource);
		idempotencyService.complete(reservation, saved.getId());
		record(
				"MENU_RESOURCE_STATUS_CHANGED",
				actorAccountId,
				"MENU_RESOURCE",
				saved.getId(),
				beforeStatus.name(),
				status.name(),
				requiredText(command.reason(), "reason", "请填写状态调整原因。"));
		return toMenuResourceResponse(saved);
	}

	@Transactional(readOnly = true)
	public MenuResourceImpactResponse getMenuResourceImpact(UUID resourceId) {
		MenuResource resource = requireMenuResource(resourceId);
		List<PermissionItem> permissions = permissionItemRepository.findAll().stream()
				.filter(item -> item.getMenuResource() != null && item.getMenuResource().getId().equals(resource.getId()))
				.toList();
		Set<UUID> permissionIds = permissions.stream().map(PermissionItem::getId)
				.collect(java.util.stream.Collectors.toSet());
		long roleGrantCount = rolePermissionGrantRepository.findAll().stream()
				.filter(grant -> permissionIds.contains(grant.getPermissionItem().getId()))
				.count();
		long temporaryGrantCount = temporaryGrantRepository.findAll().stream()
				.filter(grant -> permissionIds.contains(grant.getPermissionItem().getId()))
				.count();
		long directChildCount = menuResourceRepository.findAll().stream()
				.filter(candidate -> candidate.getParent() != null && candidate.getParent().getId().equals(resource.getId()))
				.count();
		return new MenuResourceImpactResponse(
				resource.getId(),
				directChildCount,
				permissions.size(),
				roleGrantCount,
				temporaryGrantCount);
	}

	@Transactional(readOnly = true)
	public List<PermissionItemResponse> listPermissionItems() {
		return permissionItemRepository.findAll().stream()
				.sorted(Comparator.comparing(PermissionItem::getCode))
				.map(this::toPermissionItemResponse)
				.toList();
	}

	@Transactional(readOnly = true)
	public PermissionItemResponse getPermissionItem(String code) {
		return toPermissionItemResponse(requirePermissionItem(code));
	}

	@Transactional(readOnly = true)
	public List<AccessRoleResponse> listRoles(
			AccessRoleType roleType,
			AccessRoleStatus status,
			String keyword) {
		String normalizedKeyword = trimOrNull(keyword);
		return accessRoleRepository.findAll().stream()
				.filter(role -> roleType == null || role.getRoleType() == roleType)
				.filter(role -> status == null || role.getStatus() == status)
				.filter(role -> normalizedKeyword == null
						|| role.getCode().toLowerCase(Locale.ROOT).contains(normalizedKeyword.toLowerCase(Locale.ROOT))
						|| role.getName().toLowerCase(Locale.ROOT).contains(normalizedKeyword.toLowerCase(Locale.ROOT)))
				.sorted(Comparator.comparing(AccessRole::getRoleType).thenComparing(AccessRole::getName))
				.map(this::toAccessRoleResponse)
				.toList();
	}

	@Transactional(readOnly = true)
	public AccessRoleResponse getRole(UUID roleId) {
		return toAccessRoleResponse(requireRole(roleId));
	}

	@Transactional
	public AccessRoleResponse createRole(
			CreateRoleCommand command,
			SessionPrincipal actor,
			String idempotencyKey) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"ACCESS_ROLE_CREATE:" + actor.accountId(), idempotencyKey, fingerprint(command));
		if (reservation.replayed() && reservation.targetId() != null) {
			return getRole(reservation.targetId());
		}

		String code = normalizeStableCode(command.code(), "code");
		if (accessRoleRepository.findAll().stream().anyMatch(role -> role.getCode().equals(code))) {
			throw conflict("DUPLICATE_ROLE_CODE", "角色编码已存在。", "code");
		}
		AccessRoleType roleType = required(command.roleType(), "roleType", "请选择角色类型。");
		int delegationLevel = requireNonNegative(command.delegationLevel(), "delegationLevel");
		validateDelegationLevel(actor, delegationLevel);
		AccessRoleStatus status = command.status() == null ? AccessRoleStatus.DRAFT : command.status();
		List<GrantPlan> grants = resolveGrantPlans(command.grants(), actor);
		validateRoleStatusAndBaseline(code, status, grants);

		AccessRole saved = accessRoleRepository.saveAndFlush(new AccessRole(
				code,
				requiredText(command.name(), "name", "请输入角色名称。"),
				roleType,
				requiredText(command.responsibilitySummary(), "responsibilitySummary", "请输入角色职责说明。"),
				status,
				delegationLevel));
		saveRoleGrantPlans(saved, grants);
		idempotencyService.complete(reservation, saved.getId());
		record(
				"ACCESS_ROLE_CREATED",
				actor.accountId(),
				"ACCESS_ROLE",
				saved.getId(),
				null,
				roleSummary(saved, grants));
		return toAccessRoleResponse(saved);
	}

	@Transactional
	public AccessRoleResponse updateRole(
			UUID roleId,
			UpdateRoleCommand command,
			SessionPrincipal actor,
			String idempotencyKey) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"ACCESS_ROLE_UPDATE:" + actor.accountId(), idempotencyKey, fingerprint(List.of(roleId, command)));
		if (reservation.replayed() && reservation.targetId() != null) {
			return getRole(reservation.targetId());
		}

		AccessRole role = requireRole(roleId);
		validateVersion(role.getVersion(), command.version());
		validateExistingRoleControl(actor,role);
		int delegationLevel = requireNonNegative(command.delegationLevel(), "delegationLevel");
		if(SYSTEM_SECURITY_ADMIN.equals(role.getCode())) {
			if(delegationLevel!=role.getDelegationLevel())throw scopeExceeded("受保护的安全管理员级别不能改写。","delegationLevel");
		} else validateDelegationLevel(actor, delegationLevel);
		List<GrantPlan> grants = resolveGrantPlans(command.grants(), actor);
		validateRoleStatusAndBaseline(role.getCode(), role.getStatus(), grants);
		String before = roleSummary(role, currentGrantPlans(role));
		role.update(
				requiredText(command.name(), "name", "请输入角色名称。"),
				requiredText(command.responsibilitySummary(), "responsibilitySummary", "请输入角色职责说明。"),
				delegationLevel);
		AccessRole saved = accessRoleRepository.saveAndFlush(role);
		replaceRoleGrantPlans(saved, grants);
		idempotencyService.complete(reservation, saved.getId());
		record("ACCESS_ROLE_UPDATED", actor.accountId(), "ACCESS_ROLE", saved.getId(), before, roleSummary(saved, grants));
		return toAccessRoleResponse(saved);
	}

	@Transactional
	public AccessRoleResponse changeRoleStatus(
			UUID roleId,
			RoleStatusCommand command,
			SessionPrincipal actor,
			String idempotencyKey) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"ACCESS_ROLE_STATUS:" + actor.accountId(), idempotencyKey, fingerprint(List.of(roleId, command)));
		if (reservation.replayed() && reservation.targetId() != null) {
			return getRole(reservation.targetId());
		}

		AccessRole role = requireRole(roleId);
		validateVersion(role.getVersion(), command.version());
		validateExistingRoleControl(actor,role);
		AccessRoleStatus status = required(command.status(), "status", "请选择角色状态。");
		List<GrantPlan> currentGrants = currentGrantPlans(role);
		validateRoleStatusAndBaseline(role.getCode(), status, currentGrants);
		AccessRoleStatus beforeStatus = role.getStatus();
		role.changeStatus(status);
		AccessRole saved = accessRoleRepository.saveAndFlush(role);
		idempotencyService.complete(reservation, saved.getId());
		record(
				"ACCESS_ROLE_STATUS_CHANGED",
				actor.accountId(),
				"ACCESS_ROLE",
				saved.getId(),
				beforeStatus.name(),
				status.name(),
				requiredText(command.reason(), "reason", "请填写角色状态调整原因。"));
		return toAccessRoleResponse(saved);
	}

	@Transactional(readOnly = true)
	public RoleImpactResponse getRoleImpact(UUID roleId) {
		AccessRole role = requireRole(roleId);
		List<SystemRoleAssignment> assignments = systemRoleAssignmentRepository.findAll().stream()
				.filter(assignment -> assignment.getRole().getId().equals(role.getId()))
				.toList();
		Set<UUID> permissionIds = rolePermissionGrantRepository.findAllByRoleIdOrderByPermissionItemCodeAsc(role.getId())
				.stream()
				.map(grant -> grant.getPermissionItem().getId())
				.collect(java.util.stream.Collectors.toSet());
		long relatedTemporaryGrants = temporaryGrantRepository.findAll().stream()
				.filter(grant -> permissionIds.contains(grant.getPermissionItem().getId()))
				.count();
		return new RoleImpactResponse(
				role.getId(),
				assignments.stream().filter(assignment -> assignment.getStatus() == SystemRoleAssignmentStatus.ACTIVE).count(),
				assignments.size(),
				permissionIds.size(),
				relatedTemporaryGrants);
	}

	@Transactional(readOnly = true)
	public List<SystemRoleAssignmentResponse> listSystemRoleAssignments(UUID accountId) {
		return systemRoleAssignmentRepository.findAll().stream()
				.filter(assignment -> accountId == null || assignment.getAccountId().equals(accountId))
				.sorted(Comparator.comparing(SystemRoleAssignment::getAssignedAt).reversed())
				.map(this::toSystemRoleAssignmentResponse)
				.toList();
	}

	@Transactional(readOnly = true)
	public SystemRoleAssignmentSetResponse getSystemRoleAssignments(UUID accountId) {
		if (accountId == null || accountDirectory.findAuthorizationSnapshot(accountId).isEmpty()) {
			throw notFound("未找到账号。");
		}
		return getSystemRoleAssignmentSet(accountId);
	}

	@Transactional
	public SystemRoleAssignmentSetResponse replaceSystemRoleAssignments(
			UUID accountId,
			ReplaceSystemRoleAssignmentsCommand command,
			SessionPrincipal actor,
			String idempotencyKey) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"SYSTEM_ROLE_ASSIGNMENTS_REPLACE:" + actor.accountId(), idempotencyKey, fingerprint(List.of(accountId, command)));
		if (reservation.replayed() && reservation.targetId() != null) {
			return getSystemRoleAssignmentSet(reservation.targetId());
		}

		AccountAuthorizationSnapshot recipient = requireEnabledAccount(accountId, "accountId");
		SystemRoleAssignmentSet assignmentSet = systemRoleAssignmentSetRepository.findLockedByAccountId(accountId)
				.orElseGet(() -> systemRoleAssignmentSetRepository.saveAndFlush(new SystemRoleAssignmentSet(accountId)));
		validateVersion(assignmentSet.getVersion(), command.version());

		Set<UUID> desiredRoleIds = command.roleIds() == null ? Set.of() : Set.copyOf(command.roleIds());
		Map<UUID, AccessRole> desiredRoles = new LinkedHashMap<>();
		for (UUID roleId : desiredRoleIds) {
			AccessRole role = requireRole(roleId);
			if (role.getRoleType() != AccessRoleType.SYSTEM) {
				throw validation("roleIds", "系统角色授权只能选择系统角色。");
			}
			if (role.getStatus() != AccessRoleStatus.ENABLED) {
				throw conflict("ROLE_UNAVAILABLE", "不能向账号分配未启用的角色。", "roleIds");
			}
			validateRoleLevel(actor,role);
			validateAssignableSystemRole(actor, role);
			desiredRoles.put(role.getId(), role);
		}

		Map<UUID, SystemRoleAssignment> existingAssignments = systemRoleAssignmentRepository
				.findAllByAccountIdOrderByAssignedAtDesc(accountId)
				.stream()
				.collect(java.util.stream.Collectors.toMap(
						assignment -> assignment.getRole().getId(),
						assignment -> assignment,
						(first, second) -> first,
						LinkedHashMap::new));
		for(SystemRoleAssignment existing:existingAssignments.values()) {
			if(existing.getStatus()==SystemRoleAssignmentStatus.ACTIVE&&!desiredRoleIds.contains(existing.getRole().getId())) {
				if(recipient.bootstrapSystemAdministrator()&&SYSTEM_SECURITY_ADMIN.equals(existing.getRole().getCode()))
					throw conflict("SYSTEM_SECURITY_ADMIN_PROTECTED","首个管理员须保留正式系统安全管理员角色。","roleIds");
				validateExistingRoleControl(actor,existing.getRole());
			}
		}
		boolean changed = false;
		for (Map.Entry<UUID, AccessRole> desired : desiredRoles.entrySet()) {
			SystemRoleAssignment existing = existingAssignments.get(desired.getKey());
			if (existing == null) {
				systemRoleAssignmentRepository.save(new SystemRoleAssignment(accountId, desired.getValue(), actor.accountId()));
				changed = true;
			} else if (existing.getStatus() != SystemRoleAssignmentStatus.ACTIVE) {
				existing.activate(actor.accountId());
				changed = true;
			}
		}
		for (SystemRoleAssignment existing : existingAssignments.values()) {
			if (existing.getStatus() == SystemRoleAssignmentStatus.ACTIVE
					&& !desiredRoleIds.contains(existing.getRole().getId())) {
				existing.revoke();
				changed = true;
			}
		}
		if (changed) {
			assignmentSet.touch();
			systemRoleAssignmentSetRepository.saveAndFlush(assignmentSet);
			record(
					"SYSTEM_ROLE_ASSIGNMENTS_REPLACED",
					actor.accountId(),
					"USER_ACCOUNT",
					recipient.accountId(),
					existingAssignments.keySet().toString(),
					desiredRoles.keySet().toString(),
					requiredText(command.reason(), "reason", "请填写授权调整原因。"));
		}
		idempotencyService.complete(reservation, accountId);
		return getSystemRoleAssignmentSet(accountId);
	}

	@Transactional(readOnly = true)
	public List<TemporaryGrantResponse> listTemporaryGrants(
			UUID recipientAccountId,
			TemporaryGrantStatus status,SessionPrincipal actor) {
		return temporaryGrantRepository.findAll().stream()
				.filter(grant -> recipientAccountId == null || grant.getRecipientAccountId().equals(recipientAccountId))
				.filter(grant -> status == null || grant.getStatus() == status)
				.sorted(Comparator.comparing(TemporaryGrant::getEndsAt).reversed())
				.map(g->toTemporaryGrantResponse(g,actor))
				.toList();
	}

	@Transactional
	public TemporaryGrantResponse createTemporaryGrant(
			CreateTemporaryGrantCommand command,
			SessionPrincipal actor,
			String idempotencyKey) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"TEMPORARY_GRANT_CREATE:"+actor.accountId(),
				idempotencyKey,
				"recipient=" + command.recipientAccountId() + "|permission=" + command.permissionCode() + "|scope="
						+ command.dataScope() + "|refs=" + command.scopeReferences() + "|start=" + command.startsAt()
						+ "|end=" + command.endsAt() + "|reviewer=" + command.reviewerAccountId()+"|reason="+command.reason());
		if (reservation.replayed() && reservation.targetId() != null) {
			return getTemporaryGrant(reservation.targetId(),actor);
		}

		AccountAuthorizationSnapshot recipient = requireEnabledAccount(command.recipientAccountId(), "recipientAccountId");
		PermissionItem permission = requirePermissionItem(command.permissionCode());
		if (permission.getStatus() != PermissionItemStatus.ENABLED) {
			throw conflict("PERMISSION_ITEM_UNAVAILABLE", "不能授予已停用的权限项。", "permissionCode");
		}
		DataScope dataScope = required(command.dataScope(), "dataScope", "请选择数据范围。");
		String scopeReferences = validateTemporaryGrantScope(dataScope, command.scopeReferences());
		Instant startsAt = required(command.startsAt(), "startsAt", "请选择生效时间。");
		Instant endsAt = required(command.endsAt(), "endsAt", "请选择结束时间。");
		validateTemporaryGrantWindow(permission, startsAt, endsAt, command.reviewerAccountId(), actor.accountId());
		validateDelegatablePermission(actor, permission);
		validateTemporaryGrantScopeWithinActor(actor, permission, recipient, dataScope, scopeReferences);

		UUID reviewerAccountId = command.reviewerAccountId();
		if (reviewerAccountId != null) {
			AccountAuthorizationSnapshot reviewer = requireEnabledAccount(reviewerAccountId, "reviewerAccountId");
			if (reviewer.accountId().equals(actor.accountId()) || reviewer.accountId().equals(recipient.accountId())) {
				throw validation("reviewerAccountId", "复核人必须是与授予人、受授人不同的启用账号。");
			}
			if(permission.getRiskLevel()==RiskLevel.HIGH&&!authorizationService.decide(principal(reviewer),
				AccessControlPermissions.IAM_TEMPORARY_GRANT_REVIEW,ResourceContext.empty()).allowed())
				throw validation("reviewerAccountId","指定复核人没有独立授权复核权限。");
		}
		TemporaryGrant saved = temporaryGrantRepository.saveAndFlush(new TemporaryGrant(
				recipient.accountId(),
				permission,
				dataScope,
				scopeReferences,
				startsAt,
				endsAt,
				requiredText(command.reason(), "reason", "请填写临时授权原因。"),
				reviewerAccountId,actor.accountId()));
		idempotencyService.complete(reservation, saved.getId());
		record(
				"TEMPORARY_GRANT_CREATED",
				actor.accountId(),
				"TEMPORARY_GRANT",
				saved.getId(),
				null,
				"recipient=" + recipient.accountId() + ",permission=" + permission.getCode() + ",scope=" + dataScope);
		return toTemporaryGrantResponse(saved,actor);
	}

	@Transactional
	public TemporaryGrantResponse reviewTemporaryGrant(UUID grantId,ReviewTemporaryGrantCommand command,
		SessionPrincipal actor,String idempotencyKey) {
		if(!authorizationService.decide(actor,AccessControlPermissions.IAM_TEMPORARY_GRANT_REVIEW,ResourceContext.empty()).allowed())
			throw scopeExceeded("当前账号无独立复核权限。","decision");
		var reservation=idempotencyService.reserve("TEMPORARY_GRANT_REVIEW:"+actor.accountId(),idempotencyKey,
			grantId+"|"+command.version()+"|"+command.decision()+"|"+command.comment());
		if(reservation.replayed()&&reservation.targetId()!=null)return getTemporaryGrant(reservation.targetId(),actor);
		var grant=requireTemporaryGrant(grantId);validateVersion(grant.getVersion(),command.version());
		if(grant.getStatus()!=TemporaryGrantStatus.PENDING_REVIEW)throw conflict("TEMPORARY_GRANT_NOT_PENDING","此授权不在待复核状态。","status");
		if(grant.getCreatedByAccountId()==null)throw conflict("TEMPORARY_GRANT_LEGACY_REVIEW_REQUIRED","历史授权缺少原授予人，请撤销后重新申请。","status");
		if(!actor.accountId().equals(grant.getReviewerAccountId())||actor.accountId().equals(grant.getCreatedByAccountId())||actor.accountId().equals(grant.getRecipientAccountId()))
			throw scopeExceeded("仅指定且独立的复核人可以处理。","decision");
		if(!Set.of("APPROVED","REJECTED").contains(command.decision()))throw validation("decision","请选择批准或拒绝。");
		String comment=requiredText(command.comment(),"comment","请填写复核意见。");
		if(comment.length()>1000)throw validation("comment","复核意见不能超过 1000 字。");
		if("APPROVED".equals(command.decision())) {
			if(!grant.getEndsAt().isAfter(Instant.now()))throw conflict("TEMPORARY_GRANT_EXPIRED","原授权期限已结束，请重新申请。","endsAt");
			var recipient=requireEnabledAccount(grant.getRecipientAccountId(),"recipientAccountId");
			var creator=principal(requireEnabledAccount(grant.getCreatedByAccountId(),"createdByAccountId"));
			var permission=grant.getPermissionItem();
			validateDelegatablePermission(creator,permission);
			validateTemporaryGrantScopeWithinActor(creator,permission,recipient,grant.getDataScope(),grant.getScopeReferences());
		}
		grant.review("APPROVED".equals(command.decision()),actor.accountId(),comment,Instant.now());
		temporaryGrantRepository.saveAndFlush(grant);idempotencyService.complete(reservation,grantId);
		record("TEMPORARY_GRANT_REVIEWED",actor.accountId(),"TEMPORARY_GRANT",grantId,"PENDING_REVIEW",grant.getStatus().name(),comment);
		return toTemporaryGrantResponse(grant,actor);
	}

	@Transactional
	public TemporaryGrantResponse revokeTemporaryGrant(
			UUID grantId,
			RevokeTemporaryGrantCommand command,
			SessionPrincipal actor,
			String idempotencyKey) {
		IdempotencyService.IdempotencyReservation reservation = idempotencyService.reserve(
				"TEMPORARY_GRANT_REVOKE:"+actor.accountId(),
				idempotencyKey,
				grantId + "|reason=" + command.reason() + "|version=" + command.version());
		if (reservation.replayed() && reservation.targetId() != null) {
			return getTemporaryGrant(reservation.targetId(),actor);
		}

		TemporaryGrant grant = requireTemporaryGrant(grantId);
		validateVersion(grant.getVersion(), command.version());
		if (grant.getStatus() != TemporaryGrantStatus.ACTIVE && grant.getStatus()!=TemporaryGrantStatus.PENDING_REVIEW) {
			throw conflict("TEMPORARY_GRANT_NOT_ACTIVE", "该临时授权已撤销或已到期。", "status");
		}
		if(grant.getPermissionItem().getRiskLevel()==RiskLevel.HIGH&&!isSecurityAdmin(actor))throw scopeExceeded("高敏感授权仅由正式安全管理员撤销。","permissionCode");
		String reason = requiredText(command.reason(), "reason", "请填写撤销原因。");
		grant.revoke(actor.accountId(), reason, Instant.now());
		TemporaryGrant saved = temporaryGrantRepository.saveAndFlush(grant);
		idempotencyService.complete(reservation, saved.getId());
		record(
				"TEMPORARY_GRANT_REVOKED",
				actor.accountId(),
				"TEMPORARY_GRANT",
				saved.getId(),
				"ACTIVE",
				"REVOKED",
				reason);
		return toTemporaryGrantResponse(saved,actor);
	}

	@Transactional
	public PermissionPreviewResponse previewPermission(
			PermissionPreviewCommand command,
			SessionPrincipal actor) {
		AccountAuthorizationSnapshot subject = accountDirectory.findAuthorizationSnapshot(command.subjectAccountId())
				.orElseThrow(() -> notFound("未找到待预览的账号。"));
		PermissionItem permission = requirePermissionItem(command.permissionCode());
		ResourceContext context = new ResourceContext(
				subject.accountId(),
				command.organizationUnitId(),
				command.projectId(),
				trimOrNull(command.objectReference()),
				command.participatingProject(),
				command.resourceEnabled(),
				command.recordStateAllowed(),
				command.sensitiveConditionsMet());
		AuthorizationDecision decision = authorizationService.decide(
				new SessionPrincipal(
						subject.accountId(),
						subject.loginName(),
						subject.displayName(),
						subject.bootstrapSystemAdministrator(),
						false,
						UUID.randomUUID()),
				permission.getCode(),
				context);
		auditRecorder.record(new AuditEventCommand(
				"PERMISSION_PREVIEWED",
				actor.accountId(),
				"USER_ACCOUNT",
				subject.accountId(),
				decision.allowed() ? AuditOutcome.SUCCEEDED : AuditOutcome.DENIED,
				CorrelationIdHolder.currentOrCreate(),
				decision.reasonCode(),
				null,
				"permission=" + permission.getCode()));
		return new PermissionPreviewResponse(
				subject.accountId(),
				permission.getCode(),
				decision.allowed(),
				decision.reasonCode(),
				decision.explanation());
	}

	private MenuResourceResponse getMenuResource(UUID resourceId) {
		return toMenuResourceResponse(requireMenuResource(resourceId));
	}

	private SystemRoleAssignmentSetResponse getSystemRoleAssignmentSet(UUID accountId) {
		long version = systemRoleAssignmentSetRepository.findById(accountId)
				.map(SystemRoleAssignmentSet::getVersion)
				.orElse(0L);
		return new SystemRoleAssignmentSetResponse(
				accountId,
				version,
				listSystemRoleAssignments(accountId));
	}

	private TemporaryGrantResponse getTemporaryGrant(UUID grantId,SessionPrincipal actor) {
		return toTemporaryGrantResponse(requireTemporaryGrant(grantId),actor);
	}

	private MenuResource resolveMenuParent(
			MenuResourceType resourceType,
			UUID parentId,
			MenuResource currentResource) {
		if (resourceType == MenuResourceType.DIRECTORY) {
			if (parentId != null) {
				throw validation("parentId", "目录资源不能指定上级资源。");
			}
			return null;
		}
		if (parentId == null) {
			throw validation("parentId", "该资源类型必须选择上级菜单资源。");
		}
		MenuResource parent = requireMenuResource(parentId);
		if (parent.getStatus() != MenuResourceStatus.ENABLED) {
			throw conflict("MENU_RESOURCE_UNAVAILABLE", "不能挂载到已停用的菜单资源。", "parentId");
		}
		if (resourceType == MenuResourceType.MENU_PAGE && parent.getResourceType() != MenuResourceType.DIRECTORY) {
			throw validation("parentId", "菜单页只能挂载在目录资源下。");
		}
		if (resourceType == MenuResourceType.OPERATION && parent.getResourceType() != MenuResourceType.MENU_PAGE) {
			throw validation("parentId", "操作资源只能挂载在菜单页下。");
		}
		if (currentResource != null && wouldCreateMenuCycle(currentResource, parent)) {
			throw conflict("MENU_RESOURCE_CYCLE", "上级资源不能是当前资源或其子级。", "parentId");
		}
		return parent;
	}

	private boolean wouldCreateMenuCycle(MenuResource currentResource, MenuResource candidateParent) {
		MenuResource cursor = candidateParent;
		while (cursor != null) {
			if (cursor.getId().equals(currentResource.getId())) {
				return true;
			}
			cursor = cursor.getParent();
		}
		return false;
	}

	private MenuKeys validateMenuKeys(
			MenuResourceType resourceType,
			String routeKey,
			String actionKey,
			String iconKey) {
		String normalizedRouteKey = trimOrNull(routeKey);
		String normalizedActionKey = trimOrNull(actionKey);
		String normalizedIconKey = trimOrNull(iconKey);
		if (normalizedIconKey != null && !RegisteredIconRegistry.contains(normalizedIconKey)) {
			throw resourceKeyNotRegistered("iconKey", "图标键未注册，不能保存。");
		}
		if (resourceType == MenuResourceType.DIRECTORY) {
			if (normalizedRouteKey != null || normalizedActionKey != null) {
				throw validation("routeKey", "目录资源不能绑定路由或动作键。");
			}
			return new MenuKeys(null, null, normalizedIconKey);
		}
		if (resourceType == MenuResourceType.MENU_PAGE) {
			if (normalizedActionKey != null) {
				throw validation("actionKey", "菜单页不能绑定动作键。");
			}
			if (normalizedRouteKey == null || !RegisteredNavigationRegistry.contains(normalizedRouteKey)) {
				throw routeKeyNotAllowed();
			}
			return new MenuKeys(normalizedRouteKey, null, normalizedIconKey);
		}
		if (normalizedRouteKey != null) {
			throw validation("routeKey", "操作资源不能绑定路由键。");
		}
		if (normalizedActionKey == null || !RegisteredActionRegistry.contains(normalizedActionKey)) {
			throw resourceKeyNotRegistered("actionKey", "动作键未注册，不能保存。");
		}
		return new MenuKeys(null, normalizedActionKey, normalizedIconKey);
	}

	private List<GrantPlan> resolveGrantPlans(
			Collection<RolePermissionGrantCommand> commands,
			SessionPrincipal actor) {
		List<RolePermissionGrantCommand> source = commands == null ? List.of() : List.copyOf(commands);
		List<GrantPlan> plans = new ArrayList<>();
		Set<String> uniqueKeys = new LinkedHashSet<>();
		for (int index = 0; index < source.size(); index++) {
			RolePermissionGrantCommand command = source.get(index);
			if (command == null) {
				throw validation("grants[" + index + "]", "权限矩阵中存在空项。");
			}
			PermissionItem permission = requirePermissionItem(command.permissionCode());
			if (permission.getStatus() != PermissionItemStatus.ENABLED) {
				throw conflict("PERMISSION_ITEM_UNAVAILABLE", "权限矩阵不能引用已停用的权限项。", "grants[" + index + "].permissionCode");
			}
			DataScope dataScope = required(command.dataScope(), "grants[" + index + "].dataScope", "请选择数据范围。");
			String references = normalizeScopeReferences(dataScope, command.scopeReferences(), "grants[" + index + "].scopeReferences");
			if (permission.getDimension() == PermissionDimension.MENU && dataScope != DataScope.ALL_ORGANIZATION) {
				throw validation("grants[" + index + "].dataScope", "菜单可见权限必须使用全组织范围，避免导航与服务端决策不一致。");
			}
			validateDelegatablePermission(actor, permission);
			String uniqueKey = permission.getCode() + "|" + dataScope + "|" + references;
			if (!uniqueKeys.add(uniqueKey)) {
				throw validation("grants", "权限矩阵中不能重复相同的权限项、范围和对象。");
			}
			plans.add(new GrantPlan(
					permission,
					dataScope,
					references,
					trimToLength(command.conditionSummary(), 1000, "grants[" + index + "].conditionSummary")));
		}
		return List.copyOf(plans);
	}

	private List<GrantPlan> currentGrantPlans(AccessRole role) {
		return rolePermissionGrantRepository.findAllByRoleIdOrderByPermissionItemCodeAsc(role.getId()).stream()
				.map(grant -> new GrantPlan(
						grant.getPermissionItem(),
						grant.getDataScope(),
						grant.getScopeReferences(),
						grant.getConditionSummary()))
				.toList();
	}

	private void validateRoleStatusAndBaseline(
			String roleCode,
			AccessRoleStatus status,
			List<GrantPlan> grants) {
		if (status == AccessRoleStatus.ENABLED && grants.isEmpty()) {
			throw validation("grants", "启用角色至少需要配置一项权限。");
		}
		if (!SYSTEM_SECURITY_ADMIN.equals(roleCode)) {
			return;
		}
		if (status != AccessRoleStatus.ENABLED) {
			throw conflict("SYSTEM_SECURITY_ADMIN_PROTECTED", "首个系统安全管理员角色必须保持启用。", "status");
		}
		Set<String> grantedPermissionCodes = grants.stream()
				.map(plan -> plan.permission().getCode())
				.collect(java.util.stream.Collectors.toSet());
		if (!grantedPermissionCodes.contains(AccessControlPermissions.IAM_ROLE_MANAGE)
				|| !grantedPermissionCodes.contains(AccessControlPermissions.IAM_SYSTEM_ROLE_ASSIGNMENT_MANAGE)
				|| !grantedPermissionCodes.contains(AccessControlPermissions.IAM_TEMPORARY_GRANT_MANAGE)) {
			throw conflict(
					"SYSTEM_SECURITY_ADMIN_BASELINE_REQUIRED",
					"首个系统安全管理员角色必须保留角色、系统角色授权和临时授权管理能力。",
					"grants");
		}
	}

	private void saveRoleGrantPlans(AccessRole role, List<GrantPlan> grants) {
		if (grants.isEmpty()) {
			return;
		}
		rolePermissionGrantRepository.saveAllAndFlush(grants.stream()
				.map(plan -> new RolePermissionGrant(
						role,
						plan.permission(),
						plan.dataScope(),
						plan.scopeReferences(),
						plan.conditionSummary()))
				.toList());
	}

	private void replaceRoleGrantPlans(AccessRole role, List<GrantPlan> grants) {
		List<RolePermissionGrant> existing = rolePermissionGrantRepository.findAllByRoleIdOrderByPermissionItemCodeAsc(role.getId());
		if (!existing.isEmpty()) {
			rolePermissionGrantRepository.deleteAll(existing);
			rolePermissionGrantRepository.flush();
		}
		saveRoleGrantPlans(role, grants);
	}

	private void validateDelegatablePermission(SessionPrincipal actor, PermissionItem permission) {
		if(permission.getRiskLevel()==RiskLevel.HIGH&&!isSecurityAdmin(actor))throw scopeExceeded("高敏感权限仅由正式系统安全管理员维护。","permissionCode");
		if (!permission.isCanDelegate()) {
			throw scopeExceeded("该权限项未开放下放授权。", "permissionCode");
		}
		if (!authorizationService.decide(actor, permission.getCode(), ResourceContext.empty()).allowed()) {
			throw scopeExceeded("当前账号不能下放该权限项。", "permissionCode");
		}
	}

	private void validateDelegationLevel(SessionPrincipal actor, int targetDelegationLevel) {
		int actorDelegationLevel = maxDelegationLevel(actor);
		if (actorDelegationLevel <= targetDelegationLevel) {
			throw scopeExceeded("目标角色须严格低于当前账号可下放层级。", "delegationLevel");
		}
	}

	private void validateRoleLevel(SessionPrincipal actor,AccessRole role) {
		if(SYSTEM_SECURITY_ADMIN.equals(role.getCode())) {
			if(!isSecurityAdmin(actor))throw scopeExceeded("只有正式安全管理员能维护此保护角色。","roleIds");
		} else validateDelegationLevel(actor,role.getDelegationLevel());
	}
	private void validateExistingRoleControl(SessionPrincipal actor,AccessRole role) {
		validateRoleLevel(actor,role);validateAssignableSystemRole(actor,role);
	}
	private boolean isSecurityAdmin(SessionPrincipal actor) {
		return actor!=null&&systemRoleAssignmentRepository.findAllByAccountIdAndStatus(actor.accountId(),SystemRoleAssignmentStatus.ACTIVE)
			.stream().map(SystemRoleAssignment::getRole).anyMatch(r->r.getStatus()==AccessRoleStatus.ENABLED&&SYSTEM_SECURITY_ADMIN.equals(r.getCode()));
	}
	private SessionPrincipal principal(AccountAuthorizationSnapshot account) {
		return new SessionPrincipal(account.accountId(),account.loginName(),account.displayName(),account.bootstrapSystemAdministrator(),false,null);
	}

	private void validateAssignableSystemRole(SessionPrincipal actor, AccessRole role) {
		for (GrantPlan grant : currentGrantPlans(role)) {
			validateDelegatablePermission(actor, grant.permission());
		}
	}

	private int maxDelegationLevel(SessionPrincipal actor) {
		if (actor == null) {
			return -1;
		}
		return systemRoleAssignmentRepository.findAllByAccountIdAndStatus(
						actor.accountId(),
						SystemRoleAssignmentStatus.ACTIVE)
				.stream()
				.map(SystemRoleAssignment::getRole)
				.filter(role -> role.getStatus() == AccessRoleStatus.ENABLED)
				.mapToInt(AccessRole::getDelegationLevel)
				.max()
				.orElse(-1);
	}

	private String validateTemporaryGrantScope(DataScope dataScope, String scopeReferences) {
		if (!TEMPORARY_GRANT_SCOPES.contains(dataScope)) {
			throw scopeExceeded("临时授权必须限定在可验证的最小范围内。", "dataScope");
		}
		return normalizeScopeReferences(dataScope, scopeReferences, "scopeReferences");
	}

	private void validateTemporaryGrantWindow(
			PermissionItem permission,
			Instant startsAt,
			Instant endsAt,
			UUID reviewerAccountId,
			UUID actorAccountId) {
		Instant now = Instant.now();
		if (startsAt.isBefore(now) || !endsAt.isAfter(startsAt)) {
			throw validation("endsAt", "临时授权必须使用未来且有效的服务端时间窗口。");
		}
		Duration duration = Duration.between(startsAt, endsAt);
		if (permission.getRiskLevel() == RiskLevel.HIGH) {
			if (reviewerAccountId == null) {
				throw new DomainException(
						HttpStatus.BAD_REQUEST,
						"HIGH_RISK_REVIEW_REQUIRED",
						"高敏感临时授权必须指定独立复核人。",
						List.of(new ApiProblem.FieldProblem("reviewerAccountId", "请选择独立复核人。")));
			}
			if (duration.compareTo(HIGH_RISK_TEMPORARY_GRANT_LIMIT) > 0) {
				throw durationExceeded("高敏感临时授权最长 24 小时。");
			}
			return;
		}
		if (duration.compareTo(NORMAL_TEMPORARY_GRANT_LIMIT) > 0) {
			throw durationExceeded("普通临时授权最长 7 天。");
		}
	}

	private void validateTemporaryGrantScopeWithinActor(
			SessionPrincipal actor,
			PermissionItem permission,
			AccountAuthorizationSnapshot recipient,
			DataScope dataScope,
			String scopeReferences) {
		List<ResourceContext> contexts = switch (dataScope) {
			case SELF -> List.of(new ResourceContext(
					recipient.accountId(),
					null,
					null,
					null,
					false,
					true,
					true,
					true));
			case OWN_ORG -> List.of(new ResourceContext(
					null,
					recipient.organizationUnitId(),
					null,
					null,
					false,
					true,
					true,
					true));
			case NAMED_ORG_UNITS -> splitReferences(scopeReferences).stream()
					.map(UUID::fromString)
					.map(organizationUnitId -> new ResourceContext(
							null,
							organizationUnitId,
							null,
							null,
							false,
							true,
							true,
							true))
					.toList();
			case NAMED_PROJECTS -> splitReferences(scopeReferences).stream()
					.map(UUID::fromString)
					.map(projectId -> new ResourceContext(
							null,
							null,
							projectId,
							null,
							false,
							true,
							true,
							true))
					.toList();
			case NAMED_OBJECTS -> splitReferences(scopeReferences).stream()
					.map(objectReference -> new ResourceContext(
							null,
							null,
							null,
							objectReference,
							false,
							true,
							true,
							true))
					.toList();
			default -> List.of();
		};
		if (contexts.isEmpty() || contexts.stream().anyMatch(context -> !authorizationService
				.decide(actor, permission.getCode(), context)
				.allowed())) {
			throw scopeExceeded("临时授权范围超过当前账号可下放的有效权限。", "scopeReferences");
		}
	}

	private String normalizeScopeReferences(
			DataScope dataScope,
			String source,
			String field) {
		if (!requiresReferences(dataScope)) {
			if (trimOrNull(source) != null) {
				throw validation(field, "该数据范围不能携带对象引用。");
			}
			return null;
		}
		List<String> references = splitReferences(source);
		if (references.isEmpty()) {
			throw validation(field, "该数据范围必须指定至少一个对象引用。");
		}
		if (dataScope == DataScope.NAMED_ORG_UNITS || dataScope == DataScope.NAMED_PROJECTS) {
			for (String reference : references) {
				try {
					UUID.fromString(reference);
				} catch (IllegalArgumentException exception) {
					throw validation(field, "命名组织或项目范围必须使用 UUID。");
				}
			}
		}
		if (references.size() > 100) {
			throw validation(field, "单次授权最多指定 100 个对象引用。");
		}
		return String.join(",", new LinkedHashSet<>(references));
	}

	private boolean requiresReferences(DataScope dataScope) {
		return dataScope == DataScope.NAMED_ORG_UNITS
				|| dataScope == DataScope.NAMED_PROJECTS
				|| dataScope == DataScope.NAMED_OBJECTS;
	}

	private List<String> splitReferences(String source) {
		String normalized = trimOrNull(source);
		if (normalized == null) {
			return List.of();
		}
		List<String> references = new ArrayList<>();
		for (String candidate : normalized.split(",", -1)) {
			String reference = candidate.trim();
			if (reference.isEmpty()) {
				throw validation("scopeReferences", "对象引用不能包含空值。");
			}
			references.add(reference);
		}
		return references.stream().distinct().toList();
	}

	private MenuResource requireMenuResource(UUID resourceId) {
		return menuResourceRepository.findById(resourceId)
				.orElseThrow(() -> notFound("未找到菜单资源。"));
	}

	private PermissionItem requirePermissionItem(String code) {
		String normalizedCode = requiredText(code, "permissionCode", "请选择权限项。");
		return permissionItemRepository.findByCode(normalizedCode)
				.orElseThrow(() -> notFound("未找到权限项。"));
	}

	private AccessRole requireRole(UUID roleId) {
		return accessRoleRepository.findById(roleId)
				.orElseThrow(() -> notFound("未找到角色。"));
	}

	private TemporaryGrant requireTemporaryGrant(UUID grantId) {
		return temporaryGrantRepository.findById(grantId)
				.orElseThrow(() -> notFound("未找到临时授权。"));
	}

	private AccountAuthorizationSnapshot requireEnabledAccount(UUID accountId, String field) {
		if (accountId == null) {
			throw validation(field, "请选择启用账号。");
		}
		AccountAuthorizationSnapshot account = accountDirectory.findAuthorizationSnapshot(accountId)
				.orElseThrow(() -> notFound("未找到账号。"));
		if (account.accountStatus() != AccountStatus.ENABLED) {
			throw conflict("ACCOUNT_UNAVAILABLE", "只能为启用账号维护授权。", field);
		}
		return account;
	}

	private MenuResourceResponse toMenuResourceResponse(MenuResource resource) {
		return new MenuResourceResponse(
				resource.getId(),
				resource.getCode(),
				resource.getResourceType(),
				resource.getParent() == null ? null : resource.getParent().getId(),
				resource.getName(),
				resource.getRouteKey(),
				resource.getActionKey(),
				resource.getIconKey(),
				resource.getSortOrder(),
				resource.getStatus(),
				resource.getVersion());
	}

	private PermissionItemResponse toPermissionItemResponse(PermissionItem item) {
		MenuResource resource = item.getMenuResource();
		return new PermissionItemResponse(
				item.getId(),
				item.getCode(),
				resource == null ? null : resource.getId(),
				resource == null ? null : resource.getCode(),
				item.getName(),
				item.getActionKey(),
				item.getDimension(),
				item.getRiskLevel(),
				item.isCanDelegate(),
				item.getStatus(),
				item.getVersion());
	}

	private AccessRoleResponse toAccessRoleResponse(AccessRole role) {
		List<RoleGrantResponse> grants = rolePermissionGrantRepository.findAllByRoleIdOrderByPermissionItemCodeAsc(role.getId())
				.stream()
				.map(this::toRoleGrantResponse)
				.toList();
		long activeAssignmentCount = systemRoleAssignmentRepository.findAll().stream()
				.filter(assignment -> assignment.getRole().getId().equals(role.getId()))
				.filter(assignment -> assignment.getStatus() == SystemRoleAssignmentStatus.ACTIVE)
				.count();
		return new AccessRoleResponse(
				role.getId(),
				role.getCode(),
				role.getName(),
				role.getRoleType(),
				role.getResponsibilitySummary(),
				role.getStatus(),
				role.getDelegationLevel(),
				role.getVersion(),
				activeAssignmentCount,
				grants);
	}

	private RoleGrantResponse toRoleGrantResponse(RolePermissionGrant grant) {
		PermissionItem permission = grant.getPermissionItem();
		return new RoleGrantResponse(
				grant.getId(),
				permission.getCode(),
				permission.getName(),
				permission.getActionKey(),
				permission.getDimension(),
				permission.getRiskLevel(),
				grant.getDataScope(),
				grant.getScopeReferences(),
				grant.getConditionSummary());
	}

	private SystemRoleAssignmentResponse toSystemRoleAssignmentResponse(SystemRoleAssignment assignment) {
		AccountAuthorizationSnapshot account = accountDirectory.findAuthorizationSnapshot(assignment.getAccountId()).orElse(null);
		AccessRole role = assignment.getRole();
		return new SystemRoleAssignmentResponse(
				assignment.getId(),
				assignment.getAccountId(),
				account == null ? null : account.loginName(),
				account == null ? null : account.displayName(),
				role.getId(),
				role.getCode(),
				role.getName(),
				assignment.getStatus(),
				assignment.getAssignedByAccountId(),
				assignment.getAssignedAt(),
				assignment.getVersion());
	}

	private TemporaryGrantResponse toTemporaryGrantResponse(TemporaryGrant grant,SessionPrincipal actor) {
		AccountAuthorizationSnapshot recipient = accountDirectory.findAuthorizationSnapshot(grant.getRecipientAccountId()).orElse(null);
		PermissionItem permission = grant.getPermissionItem();
		return new TemporaryGrantResponse(
				grant.getId(),
				grant.getRecipientAccountId(),
				recipient == null ? null : recipient.loginName(),
				recipient == null ? null : recipient.displayName(),
				permission.getCode(),
				permission.getName(),
				permission.getRiskLevel(),
				grant.getDataScope(),
				grant.getScopeReferences(),
				grant.getStartsAt(),
				grant.getEndsAt(),
				grant.getReason(),
				grant.getReviewerAccountId(),
				grant.getCreatedByAccountId(),accountName(grant.getCreatedByAccountId()),accountName(grant.getReviewerAccountId()),
				grant.getReviewedByAccountId(),grant.getReviewedAt(),grant.getReviewComment(),
				grant.getStatus(),
				grant.getRevokedAt(),
				grant.getRevokedByAccountId(),
				grant.getRevokeReason(),
				grant.getVersion(),temporaryActions(grant,actor));
	}
	private String accountName(UUID accountId) { return accountId==null?null:accountDirectory.findAuthorizationSnapshot(accountId).map(AccountAuthorizationSnapshot::displayName).orElse(null); }
	private List<String> temporaryActions(TemporaryGrant grant,SessionPrincipal actor) {
		var actions=new ArrayList<String>();
		if(grant.getStatus()==TemporaryGrantStatus.PENDING_REVIEW&&grant.getCreatedByAccountId()!=null&&actor.accountId().equals(grant.getReviewerAccountId())
			&&!actor.accountId().equals(grant.getCreatedByAccountId())&&!actor.accountId().equals(grant.getRecipientAccountId())
			&&authorizationService.decide(actor,AccessControlPermissions.IAM_TEMPORARY_GRANT_REVIEW,ResourceContext.empty()).allowed())actions.add("REVIEW");
		if((grant.getStatus()==TemporaryGrantStatus.ACTIVE||grant.getStatus()==TemporaryGrantStatus.PENDING_REVIEW)
			&&(grant.getPermissionItem().getRiskLevel()!=RiskLevel.HIGH||isSecurityAdmin(actor))
			&&authorizationService.decide(actor,AccessControlPermissions.IAM_TEMPORARY_GRANT_MANAGE,ResourceContext.empty()).allowed())actions.add("REVOKE");
		return actions;
	}

	private String menuSummary(MenuResource resource) {
		return "code=" + resource.getCode()
				+ ",parent=" + (resource.getParent() == null ? "ROOT" : resource.getParent().getCode())
				+ ",route=" + resource.getRouteKey()
				+ ",action=" + resource.getActionKey()
				+ ",status=" + resource.getStatus();
	}

	private String roleSummary(AccessRole role, List<GrantPlan> grants) {
		return "code=" + role.getCode()
				+ ",type=" + role.getRoleType()
				+ ",status=" + role.getStatus()
				+ ",level=" + role.getDelegationLevel()
				+ ",grants=" + compact(grants.stream()
						.map(plan -> plan.permission().getCode() + ":" + plan.dataScope())
						.toList());
	}

	private void record(
			String eventType,
			UUID actorAccountId,
			String subjectType,
			UUID subjectId,
			String before,
			String after) {
		record(eventType, actorAccountId, subjectType, subjectId, before, after, null);
	}

	private void record(
			String eventType,
			UUID actorAccountId,
			String subjectType,
			UUID subjectId,
			String before,
			String after,
			String reason) {
		auditRecorder.record(new AuditEventCommand(
				eventType,
				actorAccountId,
				subjectType,
				subjectId,
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				reason,
				compact(before),
				compact(after)));
	}

	private String normalizeStableCode(String source, String field) {
		String code = requiredText(source, field, "请输入稳定编码。").toUpperCase(Locale.ROOT);
		if (!STABLE_CODE.matcher(code).matches()) {
			throw validation(field, "编码只能使用大写字母、数字和下划线，且至少 3 位。");
		}
		return code;
	}

	private int requireNonNegative(Integer value, String field) {
		if (value == null || value < 0) {
			throw validation(field, "请输入不小于 0 的可下放层级。");
		}
		return value;
	}

	private <T> T required(T value, String field, String message) {
		if (value == null) {
			throw validation(field, message);
		}
		return value;
	}

	private String requiredText(String source, String field, String message) {
		String value = trimOrNull(source);
		if (value == null) {
			throw validation(field, message);
		}
		return value;
	}

	private String trimToLength(String source, int limit, String field) {
		String value = trimOrNull(source);
		if (value != null && value.length() > limit) {
			throw validation(field, "输入内容超过允许长度。");
		}
		return value;
	}

	private String trimOrNull(String source) {
		if (source == null) {
			return null;
		}
		String value = source.trim();
		return value.isEmpty() ? null : value;
	}

	private void validateVersion(long actualVersion, long expectedVersion) {
		if (actualVersion != expectedVersion) {
			throw new DomainException(
					HttpStatus.CONFLICT,
					"VERSION_CONFLICT",
					"数据已被其他操作更新，请重新加载后再试。",
					List.of());
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
				field == null ? List.of() : List.of(new ApiProblem.FieldProblem(field, message)));
	}

	private DomainException scopeExceeded(String message, String field) {
		return new DomainException(
				HttpStatus.FORBIDDEN,
				"AUTHORIZATION_SCOPE_EXCEEDED",
				message,
				List.of(new ApiProblem.FieldProblem(field, message)));
	}

	private DomainException durationExceeded(String message) {
		return new DomainException(
				HttpStatus.BAD_REQUEST,
				"GRANT_DURATION_EXCEEDED",
				message,
				List.of(new ApiProblem.FieldProblem("endsAt", message)));
	}

	private DomainException routeKeyNotAllowed() {
		return new DomainException(
				HttpStatus.BAD_REQUEST,
				"ROUTE_KEY_NOT_ALLOWED",
				"路由键未注册或当前页面未实现。",
				List.of(new ApiProblem.FieldProblem("routeKey", "请选择已注册且已实现的路由键。")));
	}

	private DomainException resourceKeyNotRegistered(String field, String message) {
		return new DomainException(
				HttpStatus.BAD_REQUEST,
				"RESOURCE_KEY_NOT_REGISTERED",
				message,
				List.of(new ApiProblem.FieldProblem(field, message)));
	}

	private DomainException notFound(String message) {
		return new DomainException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", message);
	}

	private String compact(String source) {
		if (source == null) {
			return null;
		}
		return source.length() <= 900 ? source : source.substring(0, 897) + "...";
	}

	private String compact(Collection<String> values) {
		return compact(String.join(",", values));
	}

	public record CreateMenuResourceCommand(
			String code,
			MenuResourceType resourceType,
			UUID parentId,
			String name,
			String routeKey,
			String actionKey,
			String iconKey,
			int sortOrder,
			MenuResourceStatus status) {
	}

	public record UpdateMenuResourceCommand(
			String name,
			String routeKey,
			String actionKey,
			String iconKey,
			int sortOrder,
			long version) {
	}

	public record MoveMenuResourceCommand(UUID parentId, String reason, long version) {
	}

	public record MenuResourceStatusCommand(MenuResourceStatus status, String reason, long version) {
	}

	public record RolePermissionGrantCommand(
			String permissionCode,
			DataScope dataScope,
			String scopeReferences,
			String conditionSummary) {
	}

	public record CreateRoleCommand(
			String code,
			String name,
			AccessRoleType roleType,
			String responsibilitySummary,
			AccessRoleStatus status,
			Integer delegationLevel,
			List<RolePermissionGrantCommand> grants) {
	}

	public record UpdateRoleCommand(
			String name,
			String responsibilitySummary,
			Integer delegationLevel,
			long version,
			List<RolePermissionGrantCommand> grants) {
	}

	public record RoleStatusCommand(AccessRoleStatus status, String reason, long version) {
	}

	public record ReplaceSystemRoleAssignmentsCommand(Set<UUID> roleIds, long version, String reason) {
	}

	public record CreateTemporaryGrantCommand(
			UUID recipientAccountId,
			String permissionCode,
			DataScope dataScope,
			String scopeReferences,
			Instant startsAt,
			Instant endsAt,
			String reason,
			UUID reviewerAccountId) {
	}

	public record RevokeTemporaryGrantCommand(String reason, long version) {
	}
	public record ReviewTemporaryGrantCommand(String decision,String comment,long version) {}

	public record PermissionPreviewCommand(
			UUID subjectAccountId,
			String permissionCode,
			UUID organizationUnitId,
			UUID projectId,
			String objectReference,
			boolean participatingProject,
			boolean resourceEnabled,
			boolean recordStateAllowed,
			boolean sensitiveConditionsMet) {
	}

	private record MenuKeys(String routeKey, String actionKey, String iconKey) {
	}

	private record GrantPlan(
			PermissionItem permission,
			DataScope dataScope,
			String scopeReferences,
			String conditionSummary) {
	}
}
