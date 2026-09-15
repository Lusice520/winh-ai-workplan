package com.winh.workplan.iam.authorization;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.winh.workplan.iam.account.AccountAuthorizationSnapshot;
import com.winh.workplan.iam.account.AccountDirectory;
import com.winh.workplan.iam.account.AccountStatus;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.menu.MenuResource;
import com.winh.workplan.iam.menu.MenuResourceRepository;
import com.winh.workplan.iam.menu.MenuResourceStatus;
import com.winh.workplan.iam.menu.MenuResourceType;
import com.winh.workplan.iam.organization.OrganizationDirectoryService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DefaultAuthorizationService implements AuthorizationService, AccessControlBootstrapProvisioner {
	private static final String SYSTEM_SECURITY_ADMIN = "SYSTEM_SECURITY_ADMIN";

	private final AccountDirectory accountDirectory;
	private final OrganizationDirectoryService organizationDirectoryService;
	private final MenuResourceRepository menuResourceRepository;
	private final PermissionItemRepository permissionItemRepository;
	private final AccessRoleRepository accessRoleRepository;
	private final RolePermissionGrantRepository rolePermissionGrantRepository;
	private final SystemRoleAssignmentRepository systemRoleAssignmentRepository;
	private final TemporaryGrantRepository temporaryGrantRepository;
	private final ProjectRoleAssignmentRepository projectRoleAssignmentRepository;

	DefaultAuthorizationService(
			AccountDirectory accountDirectory,
			OrganizationDirectoryService organizationDirectoryService,
			MenuResourceRepository menuResourceRepository,
			PermissionItemRepository permissionItemRepository,
			AccessRoleRepository accessRoleRepository,
			RolePermissionGrantRepository rolePermissionGrantRepository,
			SystemRoleAssignmentRepository systemRoleAssignmentRepository,
			TemporaryGrantRepository temporaryGrantRepository,
			ProjectRoleAssignmentRepository projectRoleAssignmentRepository) {
		this.accountDirectory = accountDirectory;
		this.organizationDirectoryService = organizationDirectoryService;
		this.menuResourceRepository = menuResourceRepository;
		this.permissionItemRepository = permissionItemRepository;
		this.accessRoleRepository = accessRoleRepository;
		this.rolePermissionGrantRepository = rolePermissionGrantRepository;
		this.systemRoleAssignmentRepository = systemRoleAssignmentRepository;
		this.temporaryGrantRepository = temporaryGrantRepository;
		this.projectRoleAssignmentRepository = projectRoleAssignmentRepository;
	}

	@Override
	@Transactional(readOnly = true)
	public AuthorizationDecision decide(
			SessionPrincipal subject,
			String permissionCode,
			ResourceContext resourceContext) {
		if (subject == null) {
			return AuthorizationDecision.deny("AUTHENTICATION_REQUIRED", "未找到有效登录主体。");
		}

		Optional<AccountAuthorizationSnapshot> account = accountDirectory.findAuthorizationSnapshot(subject.accountId());
		if (account.isEmpty() || account.get().accountStatus() != AccountStatus.ENABLED) {
			return AuthorizationDecision.deny("ACCOUNT_UNAVAILABLE", "账号已停用、锁定或不存在。");
		}
		if (!hardConstraintsPass(resourceContext)) {
			return AuthorizationDecision.deny("HARD_CONSTRAINT_REJECTED", "资源状态、记录状态或敏感条件不满足。");
		}

		PermissionItem permissionItem = permissionItemRepository.findByCode(permissionCode)
				.orElse(null);
		if (permissionItem == null || permissionItem.getStatus() != PermissionItemStatus.ENABLED) {
			return AuthorizationDecision.deny("PERMISSION_ITEM_UNAVAILABLE", "权限项未注册或已停用。");
		}
		if (permissionItem.getMenuResource() != null
				&& permissionItem.getMenuResource().getStatus() != MenuResourceStatus.ENABLED) {
			return AuthorizationDecision.deny("MENU_RESOURCE_UNAVAILABLE", "菜单资源已停用或不可用。");
		}

		List<AuthorizationGrant> matches = new ArrayList<>();
		matches.addAll(matchingRoleGrants(account.get(), permissionItem, resourceContext));
		matches.addAll(matchingTemporaryGrants(account.get(), permissionItem, resourceContext));
		if (matches.isEmpty()) {
			return AuthorizationDecision.deny("NO_ACTIVE_ALLOW", "没有匹配当前对象范围的有效正向授权。");
		}

		return AuthorizationDecision.allow(
				"ALLOW",
				matches.stream().map(AuthorizationGrant::explanation).toList());
	}

	@Override
	@Transactional(readOnly = true)
	public List<NavigationItem> listNavigation(SessionPrincipal subject) {
		List<MenuResource> resources = menuResourceRepository.findAllByStatusOrderBySortOrderAscNameAsc(
				MenuResourceStatus.ENABLED);
		Map<UUID, List<MenuResource>> childrenByParent = new HashMap<>();
		List<MenuResource> roots = new ArrayList<>();
		for (MenuResource resource : resources) {
			if (resource.getParent() == null) {
				roots.add(resource);
			} else {
				childrenByParent.computeIfAbsent(resource.getParent().getId(), ignored -> new ArrayList<>())
						.add(resource);
			}
		}
		return roots.stream()
				.map(resource -> toNavigationItem(subject, resource, childrenByParent))
				.flatMap(Optional::stream)
				.toList();
	}

	@Override
	@Transactional
	public void ensureBootstrapAdministratorAssignment(UUID accountId) {
		// Seed the local bootstrap account once; an explicit business-role revocation survives restart.
		accessRoleRepository.findByCode("BUSINESS_ADMIN").ifPresent(role -> {
			if (systemRoleAssignmentRepository.findByAccountIdAndRoleId(accountId, role.getId()).isEmpty()) {
				systemRoleAssignmentRepository.save(new SystemRoleAssignment(accountId, role, accountId));
			}
		});
		accessRoleRepository.findByCode(SYSTEM_SECURITY_ADMIN).ifPresent(role -> {
			systemRoleAssignmentRepository.findByAccountIdAndRoleId(accountId, role.getId())
					.ifPresentOrElse(
							assignment -> {
								if (assignment.getStatus() != SystemRoleAssignmentStatus.ACTIVE) {
									assignment.activate(accountId);
								}
							},
							() -> systemRoleAssignmentRepository.save(new SystemRoleAssignment(accountId, role, accountId)));
		});
	}

	private Optional<NavigationItem> toNavigationItem(
			SessionPrincipal subject,
			MenuResource resource,
			Map<UUID, List<MenuResource>> childrenByParent) {
		if (resource.getResourceType() == MenuResourceType.OPERATION) {
			return Optional.empty();
		}
		List<NavigationItem> children = childrenByParent.getOrDefault(resource.getId(), List.of()).stream()
				.sorted(Comparator.comparingInt(MenuResource::getSortOrder).thenComparing(MenuResource::getName))
				.map(child -> toNavigationItem(subject, child, childrenByParent))
				.flatMap(Optional::stream)
				.toList();
		if (resource.getResourceType() == MenuResourceType.DIRECTORY) {
			return children.isEmpty()
					? Optional.empty()
					: Optional.of(new NavigationItem(
							resource.getCode(), resource.getName(), null, resource.getIconKey(), children));
		}
		if (!RegisteredNavigationRegistry.contains(resource.getRouteKey())) {
			return Optional.empty();
		}
		Optional<PermissionItem> menuPermission = permissionItemRepository.findByMenuResourceIdAndDimension(
				resource.getId(), PermissionDimension.MENU);
		if (menuPermission.isEmpty()
				|| !decide(subject, menuPermission.get().getCode(), ResourceContext.empty()).allowed()) {
			return Optional.empty();
		}
		return Optional.of(new NavigationItem(
				resource.getCode(), resource.getName(), resource.getRouteKey(), resource.getIconKey(), children));
	}

	private List<AuthorizationGrant> matchingRoleGrants(
			AccountAuthorizationSnapshot account,
			PermissionItem permissionItem,
			ResourceContext resourceContext) {
		Set<UUID> roleIds = systemRoleAssignmentRepository.findAllByAccountIdAndStatus(
				account.accountId(), SystemRoleAssignmentStatus.ACTIVE)
				.stream()
				.map(SystemRoleAssignment::getRole)
				.filter(role -> role.getStatus() == AccessRoleStatus.ENABLED)
				.map(AccessRole::getId)
				.collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
		if (resourceContext.projectId() != null && resourceContext.participatingProject()) {
			projectRoleAssignmentRepository.findAllByAccountIdAndProjectIdAndActiveTrue(
					account.accountId(), resourceContext.projectId()).stream()
					.map(assignment -> assignment.role)
					.filter(role -> role.getRoleType() == AccessRoleType.PROJECT && role.getStatus() == AccessRoleStatus.ENABLED)
					.map(AccessRole::getId).forEach(roleIds::add);
		}
		if (roleIds.isEmpty()) {
			return List.of();
		}
		return rolePermissionGrantRepository.findAllByRoleIdInAndPermissionItemId(roleIds, permissionItem.getId())
				.stream()
				.filter(grant -> scopeMatches(account, grant.getDataScope(), grant.getScopeReferences(), resourceContext))
				.map(grant -> new AuthorizationGrant(
						"角色 " + grant.getRole().getCode() + " 授予 " + permissionItem.getCode()))
				.toList();
	}

	private List<AuthorizationGrant> matchingTemporaryGrants(
			AccountAuthorizationSnapshot account,
			PermissionItem permissionItem,
			ResourceContext resourceContext) {
		Instant now = Instant.now();
		return temporaryGrantRepository.findAllByRecipientAccountIdAndStatusAndStartsAtLessThanEqualAndEndsAtAfter(
				account.accountId(), TemporaryGrantStatus.ACTIVE, now, now)
				.stream()
				.filter(grant -> grant.getPermissionItem().getId().equals(permissionItem.getId()))
				.filter(grant -> scopeMatches(account, grant.getDataScope(), grant.getScopeReferences(), resourceContext))
				.map(grant -> new AuthorizationGrant("有效临时授权 " + grant.getId()))
				.toList();
	}

	private boolean hardConstraintsPass(ResourceContext resourceContext) {
		return resourceContext != null
				&& resourceContext.resourceEnabled()
				&& resourceContext.recordStateAllowed()
				&& resourceContext.sensitiveConditionsMet();
	}

	private boolean scopeMatches(
			AccountAuthorizationSnapshot account,
			DataScope dataScope,
			String references,
			ResourceContext context) {
		if (context == null) {
			return false;
		}
		return switch (dataScope) {
			case ALL_ORGANIZATION -> true;
			case ALL_PROJECTS -> context.projectId() != null;
			case SELF -> account.accountId().equals(context.subjectAccountId());
			case OWN_ORG -> account.organizationUnitId().equals(context.organizationUnitId());
			case OWN_ORG_AND_DESCENDANTS -> context.organizationUnitId() != null
					&& organizationDirectoryService.withDescendants(account.organizationUnitId())
							.contains(context.organizationUnitId());
			case NAMED_ORG_UNITS -> containsReference(references, context.organizationUnitId());
			case PARTICIPATING_PROJECTS -> context.projectId() != null && context.participatingProject();
			case NAMED_PROJECTS -> containsReference(references, context.projectId());
			case NAMED_OBJECTS -> containsReference(references, context.objectReference());
		};
	}

	private boolean containsReference(String references, Object candidate) {
		if (candidate == null || references == null || references.isBlank()) {
			return false;
		}
		return java.util.Arrays.stream(references.split("\\s*,\\s*"))
				.anyMatch(candidate.toString()::equals);
	}

	private record AuthorizationGrant(String explanation) {
	}
}
