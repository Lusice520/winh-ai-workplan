package com.winh.workplan.iam.authorization;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;

import com.winh.workplan.iam.account.UserAccount;
import com.winh.workplan.iam.account.UserAccountRepository;
import com.winh.workplan.iam.identity.PasswordPolicy;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.menu.MenuResource;
import com.winh.workplan.iam.menu.MenuResourceRepository;
import com.winh.workplan.iam.menu.MenuResourceStatus;
import com.winh.workplan.iam.menu.MenuResourceType;
import com.winh.workplan.iam.organization.OrganizationUnit;
import com.winh.workplan.iam.organization.OrganizationUnitRepository;
import com.winh.workplan.iam.organization.OrganizationUnitStatus;
import com.winh.workplan.iam.organization.OrganizationUnitType;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class AuthorizationServiceIntegrationTest {

	@Autowired
	private AuthorizationService authorizationService;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private OrganizationUnitRepository organizationUnitRepository;

	@Autowired
	private UserAccountRepository userAccountRepository;

	@Autowired
	private PasswordPolicy passwordPolicy;

	@Autowired
	private MenuResourceRepository menuResourceRepository;

	@Autowired
	private PermissionItemRepository permissionItemRepository;

	@Autowired
	private AccessRoleRepository accessRoleRepository;

	@Autowired
	private RolePermissionGrantRepository rolePermissionGrantRepository;

	@Autowired
	private SystemRoleAssignmentRepository systemRoleAssignmentRepository;

	@Autowired
	private TemporaryGrantRepository temporaryGrantRepository;

	private UserAccount authorizedAccount;
	private UserAccount unassignedAccount;
	private PermissionItem userReadPermission;
	private SessionPrincipal authorizedPrincipal;

	@BeforeEach
	void setUp() {
		jdbcTemplate.update("DELETE FROM temporary_grant");
		jdbcTemplate.update("DELETE FROM system_role_assignment_set");
		jdbcTemplate.update("DELETE FROM system_role_assignment");
		jdbcTemplate.update("DELETE FROM role_permission_grant");
		jdbcTemplate.update("DELETE FROM permission_item");
		jdbcTemplate.update("DELETE FROM menu_resource");
		jdbcTemplate.update("DELETE FROM access_role");
		jdbcTemplate.update("DELETE FROM account_session");
		jdbcTemplate.update("DELETE FROM account_status_history");
		jdbcTemplate.update("DELETE FROM account_organization_history");
		jdbcTemplate.update("DELETE FROM idempotency_record");
		jdbcTemplate.update("DELETE FROM audit_event");
		jdbcTemplate.update("DELETE FROM user_account");
		jdbcTemplate.update("DELETE FROM org_unit");

		OrganizationUnit organization = organizationUnitRepository.saveAndFlush(new OrganizationUnit(
				"权限验证组织",
				"AUTH-ROOT",
				OrganizationUnitType.COMPANY,
				null,
				null,
				0,
				OrganizationUnitStatus.ENABLED));
		authorizedAccount = userAccountRepository.saveAndFlush(new UserAccount(
				"auth-admin",
				"auth-admin",
				"授权管理员",
				null,
				null,
				null,
				organization,
				passwordPolicy.hash("Aa1!authorization-test"),
				false,
				false));
		unassignedAccount = userAccountRepository.saveAndFlush(new UserAccount(
				"auth-member",
				"auth-member",
				"普通成员",
				null,
				null,
				null,
				organization,
				passwordPolicy.hash("Aa1!authorization-member"),
				false,
				false));
		authorizedPrincipal = new SessionPrincipal(
				authorizedAccount.getId(),
				authorizedAccount.getLoginName(),
				authorizedAccount.getDisplayName(),
				false,
				false,
				UUID.randomUUID());

		userReadPermission = permissionItemRepository.saveAndFlush(new PermissionItem(
				AccessControlPermissions.IAM_USER_READ,
				null,
				"读取用户目录",
				"iam.user.read",
				PermissionDimension.ACTION,
				RiskLevel.NORMAL,
				true,
				PermissionItemStatus.ENABLED));
		AccessRole role = accessRoleRepository.saveAndFlush(new AccessRole(
				"TEST_AUTHORIZED_ROLE",
				"验证角色",
				AccessRoleType.SYSTEM,
				"验证集中授权判断。",
				AccessRoleStatus.ENABLED,
				10));
		rolePermissionGrantRepository.saveAndFlush(new RolePermissionGrant(
				role,
				userReadPermission,
				DataScope.ALL_ORGANIZATION,
				null,
				null));
		systemRoleAssignmentRepository.saveAndFlush(new SystemRoleAssignment(
				authorizedAccount.getId(), role, authorizedAccount.getId()));
	}

	@Test
	void bootstrapMarkerNeverGrantsAccessWithoutFormalAssignments() {
		SessionPrincipal bootstrapMarker = new SessionPrincipal(unassignedAccount.getId(),
			unassignedAccount.getLoginName(),unassignedAccount.getDisplayName(),true,false,UUID.randomUUID());
		assertThat(authorizationService.decide(bootstrapMarker,AccessControlPermissions.IAM_USER_READ,
			ResourceContext.empty()).allowed()).isFalse();
		assertThat(authorizationService.decide(bootstrapMarker,"UNREGISTERED_PERMISSION",
			ResourceContext.empty()).allowed()).isFalse();
		assertThat(authorizationService.decide(bootstrapMarker,AccessControlPermissions.IAM_USER_READ,
			new ResourceContext(null,null,null,null,false,false,true,true)).allowed()).isFalse();
	}

	@Test
	void positiveRoleGrantsCanAllowButHardConstraintsStillDenyFirst() {
		AuthorizationDecision allowed = authorizationService.decide(
				authorizedPrincipal,
				AccessControlPermissions.IAM_USER_READ,
				ResourceContext.empty());

		assertThat(allowed.allowed()).isTrue();
		assertThat(allowed.reasonCode()).isEqualTo("ALLOW");
		assertThat(allowed.explanation()).anyMatch(value -> value.contains("TEST_AUTHORIZED_ROLE"));

		AuthorizationDecision denied = authorizationService.decide(
				authorizedPrincipal,
				AccessControlPermissions.IAM_USER_READ,
				new ResourceContext(null, null, null, null, false, false, true, true));

		assertThat(denied.allowed()).isFalse();
		assertThat(denied.reasonCode()).isEqualTo("HARD_CONSTRAINT_REJECTED");
	}

	@Test
	void temporaryGrantOnlyAllowsTheExactNamedObjectDuringItsTimeWindow() {
		TemporaryGrant grant = temporaryGrantRepository.saveAndFlush(new TemporaryGrant(
				unassignedAccount.getId(),
				userReadPermission,
				DataScope.NAMED_OBJECTS,
				"project-object-42",
				Instant.now().minusSeconds(60),
				Instant.now().plusSeconds(300),
				"协助处理迁移验证。",
				authorizedAccount.getId()));
		SessionPrincipal member = new SessionPrincipal(
				unassignedAccount.getId(),
				unassignedAccount.getLoginName(),
				unassignedAccount.getDisplayName(),
				false,
				false,
				UUID.randomUUID());

		AuthorizationDecision matching = authorizationService.decide(
				member,
				AccessControlPermissions.IAM_USER_READ,
				new ResourceContext(null, null, null, "project-object-42", false, true, true, true));
		AuthorizationDecision differentObject = authorizationService.decide(
				member,
				AccessControlPermissions.IAM_USER_READ,
				new ResourceContext(null, null, null, "project-object-43", false, true, true, true));

		assertThat(grant.getStatus()).isEqualTo(TemporaryGrantStatus.ACTIVE);
		assertThat(matching.allowed()).isTrue();
		assertThat(matching.explanation()).anyMatch(value -> value.contains("临时授权"));
		assertThat(differentObject.allowed()).isFalse();
		assertThat(differentObject.reasonCode()).isEqualTo("NO_ACTIVE_ALLOW");
	}

	@Test
	void navigationConsumesAuthorizedRegisteredRouteKeysOnly() {
		MenuResource root = menuResourceRepository.saveAndFlush(new MenuResource(
				"TEST_DIRECTORY",
				MenuResourceType.DIRECTORY,
				null,
				"验证目录",
				null,
				null,
				"settings",
				1,
				MenuResourceStatus.ENABLED));
		MenuResource visiblePage = menuResourceRepository.saveAndFlush(new MenuResource(
				"TEST_ACCESS_CONTROL_PAGE",
				MenuResourceType.MENU_PAGE,
				root,
				"菜单与权限",
				"system.access-control",
				null,
				"shield-check",
				2,
				MenuResourceStatus.ENABLED));
		MenuResource unregisteredPage = menuResourceRepository.saveAndFlush(new MenuResource(
				"TEST_UNREGISTERED_PAGE",
				MenuResourceType.MENU_PAGE,
				root,
				"未实现页面",
				"system.not-implemented",
				null,
				"circle-help",
				3,
				MenuResourceStatus.ENABLED));
		PermissionItem visiblePermission = permissionItemRepository.saveAndFlush(new PermissionItem(
				AccessControlPermissions.NAV_IAM_ACCESS_CONTROL_VIEW,
				visiblePage,
				"查看菜单与权限菜单",
				"nav.iam.access-control.view",
				PermissionDimension.MENU,
				RiskLevel.NORMAL,
				true,
				PermissionItemStatus.ENABLED));
		PermissionItem unregisteredPermission = permissionItemRepository.saveAndFlush(new PermissionItem(
				"TEST_UNREGISTERED_NAVIGATION",
				unregisteredPage,
				"查看未实现页面",
				"nav.test.unregistered.view",
				PermissionDimension.MENU,
				RiskLevel.NORMAL,
				true,
				PermissionItemStatus.ENABLED));
		AccessRole role = accessRoleRepository.findByCode("TEST_AUTHORIZED_ROLE").orElseThrow();
		rolePermissionGrantRepository.saveAllAndFlush(java.util.List.of(
				new RolePermissionGrant(role, visiblePermission, DataScope.ALL_ORGANIZATION, null, null),
				new RolePermissionGrant(role, unregisteredPermission, DataScope.ALL_ORGANIZATION, null, null)));

		assertThat(authorizationService.listNavigation(authorizedPrincipal))
				.singleElement()
				.satisfies(directory -> {
					assertThat(directory.name()).isEqualTo("验证目录");
					assertThat(directory.children())
							.singleElement()
							.satisfies(item -> assertThat(item.routeKey()).isEqualTo("system.access-control"));
				});
	}
}
