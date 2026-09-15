package com.winh.workplan.iam.authorization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.winh.workplan.iam.account.UserAccount;
import com.winh.workplan.iam.account.UserAccountRepository;
import com.winh.workplan.iam.identity.PasswordPolicy;
import com.winh.workplan.iam.menu.MenuResource;
import com.winh.workplan.iam.menu.MenuResourceRepository;
import com.winh.workplan.iam.menu.MenuResourceStatus;
import com.winh.workplan.iam.menu.MenuResourceType;
import com.winh.workplan.iam.organization.OrganizationUnit;
import com.winh.workplan.iam.organization.OrganizationUnitRepository;
import com.winh.workplan.iam.organization.OrganizationUnitStatus;
import com.winh.workplan.iam.organization.OrganizationUnitType;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
class AccessControlControllerIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

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

	@Autowired private TemporaryGrantRepository temporaryGrantRepository;

	private UserAccount administrator;
	private UserAccount member;
	private String administratorPassword;
	private String memberPassword;
	private AccessRole formalAdministratorRole;
	private AccessRole outOfScopeSystemRole;

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

		OrganizationUnit root = organizationUnitRepository.saveAndFlush(new OrganizationUnit(
				"正式权限验证组织",
				"ACCESS-ROOT",
				OrganizationUnitType.COMPANY,
				null,
				null,
				0,
				OrganizationUnitStatus.ENABLED));
		administratorPassword = generatedPassword();
		memberPassword = generatedPassword();
		administrator = userAccountRepository.saveAndFlush(new UserAccount(
				"formal-admin",
				"formal-admin",
				"正式权限管理员",
				null,
				null,
				null,
				root,
				passwordPolicy.hash(administratorPassword),
				false,
				false));
		member = userAccountRepository.saveAndFlush(new UserAccount(
				"formal-member",
				"formal-member",
				"正式权限普通成员",
				null,
				null,
				null,
				root,
				passwordPolicy.hash(memberPassword),
				false,
				false));

		MenuResource directory = menuResourceRepository.saveAndFlush(new MenuResource(
				"TEST_SYSTEM_DIRECTORY",
				MenuResourceType.DIRECTORY,
				null,
				"系统管理",
				null,
				null,
				"settings",
				1,
				MenuResourceStatus.ENABLED));
		MenuResource page = menuResourceRepository.saveAndFlush(new MenuResource(
				"TEST_ACCESS_CONTROL_PAGE",
				MenuResourceType.MENU_PAGE,
				directory,
				"菜单与权限",
				"system.access-control",
				null,
				"shield-check",
				2,
				MenuResourceStatus.ENABLED));
		MenuResource operation = menuResourceRepository.saveAndFlush(new MenuResource(
				"TEST_ACCESS_CONTROL_OPERATION",
				MenuResourceType.OPERATION,
				page,
				"菜单与权限管理",
				null,
				"iam.access-control.manage",
				"shield-cog",
				3,
				MenuResourceStatus.ENABLED));

		PermissionItem navigation = permissionItemRepository.saveAndFlush(new PermissionItem(
				AccessControlPermissions.NAV_IAM_ACCESS_CONTROL_VIEW,
				page,
				"查看菜单与权限",
				"nav.iam.access-control.view",
				PermissionDimension.MENU,
				RiskLevel.NORMAL,
				true,
				PermissionItemStatus.ENABLED));
		PermissionItem userRead = permissionItemRepository.saveAndFlush(new PermissionItem(
				AccessControlPermissions.IAM_USER_READ,
				operation,
				"读取用户目录",
				"iam.user.read",
				PermissionDimension.ACTION,
				RiskLevel.NORMAL,
				true,
				PermissionItemStatus.ENABLED));
		PermissionItem roleRead = permissionItemRepository.saveAndFlush(new PermissionItem(
				AccessControlPermissions.IAM_ROLE_READ,
				operation,
				"读取角色目录",
				"iam.role.read",
				PermissionDimension.ACTION,
				RiskLevel.NORMAL,
				true,
				PermissionItemStatus.ENABLED));
		PermissionItem assignmentManage = permissionItemRepository.saveAndFlush(new PermissionItem(
				AccessControlPermissions.IAM_SYSTEM_ROLE_ASSIGNMENT_MANAGE,
				operation,
				"维护系统角色授权",
				"iam.system-role-assignment.manage",
				PermissionDimension.ACTION,
				RiskLevel.HIGH,
				true,
				PermissionItemStatus.ENABLED));
		PermissionItem temporaryGrantManage = permissionItemRepository.saveAndFlush(new PermissionItem(
				AccessControlPermissions.IAM_TEMPORARY_GRANT_MANAGE,
				operation,
				"维护临时授权",
				"iam.temporary-grant.manage",
				PermissionDimension.ACTION,
				RiskLevel.HIGH,
				true,
				PermissionItemStatus.ENABLED));
		PermissionItem highRiskTarget = permissionItemRepository.saveAndFlush(new PermissionItem(
				"TEST_HIGH_RISK_TARGET",
				operation,
				"高敏感验证动作",
				"test.high-risk-target",
				PermissionDimension.ACTION,
				RiskLevel.HIGH,
				true,
				PermissionItemStatus.ENABLED));
		PermissionItem outOfScopeTarget = permissionItemRepository.saveAndFlush(new PermissionItem(
				"TEST_OUT_OF_SCOPE_TARGET",
				operation,
				"不可下放的目标动作",
				"test.out-of-scope-target",
				PermissionDimension.ACTION,
				RiskLevel.NORMAL,
				true,
				PermissionItemStatus.ENABLED));

		formalAdministratorRole = accessRoleRepository.saveAndFlush(new AccessRole(
				"SYSTEM_SECURITY_ADMIN",
				"正式安全管理员",
				AccessRoleType.SYSTEM,
				"通过正式系统角色验证统一权限链。",
				AccessRoleStatus.ENABLED,
				100));
		rolePermissionGrantRepository.saveAllAndFlush(List.of(
				grant(navigation),
				grant(userRead),
				grant(roleRead),
				grant(assignmentManage),
				grant(temporaryGrantManage),
				grant(highRiskTarget)));
		outOfScopeSystemRole = accessRoleRepository.saveAndFlush(new AccessRole(
				"OUT_OF_SCOPE_SYSTEM_ROLE",
				"范围外系统角色",
				AccessRoleType.SYSTEM,
				"仅用于验证角色分配不能间接越权。",
				AccessRoleStatus.ENABLED,
				50));
		rolePermissionGrantRepository.saveAndFlush(new RolePermissionGrant(
				outOfScopeSystemRole,
				outOfScopeTarget,
				DataScope.ALL_ORGANIZATION,
				null,
				null));
		systemRoleAssignmentRepository.saveAndFlush(new SystemRoleAssignment(
				administrator.getId(),
				formalAdministratorRole,
				administrator.getId()));
	}

	@Test
	void formalRoleControlsNavigationAndCannotBeBypassedThroughIamHttpEndpoints() throws Exception {
		CsrfState csrfState = fetchCsrf();
		Cookie administratorSession = login("formal-admin", administratorPassword, csrfState);
		Cookie memberSession = login("formal-member", memberPassword, csrfState);

		mockMvc.perform(get("/api/access-control/navigation").cookie(administratorSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].children[0].routeKey").value("system.access-control"));
		mockMvc.perform(get("/api/access-control/roles").cookie(administratorSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].code").value("SYSTEM_SECURITY_ADMIN"));
		mockMvc.perform(get("/api/iam/users?page=1&pageSize=10").cookie(administratorSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(2));

		mockMvc.perform(get("/api/access-control/navigation").cookie(memberSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isEmpty());
		mockMvc.perform(get("/api/access-control/roles").cookie(memberSession))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
		mockMvc.perform(get("/api/iam/users?page=1&pageSize=10").cookie(memberSession))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
		Long deniedAuditEvents = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM audit_event WHERE actor_account_id = ? AND event_type = ? AND outcome = ?",
				Long.class,
				member.getId(),
				"AUTHORIZATION_HTTP_DENIED",
				"DENIED");
		assertThat(deniedAuditEvents).isEqualTo(2L);
	}

	@Test
	void replacementAssignmentsAndHighRiskTemporaryGrantRulesAreEnforcedThroughTheApi() throws Exception {
		CsrfState csrfState = fetchCsrf();
		Cookie administratorSession = login("formal-admin", administratorPassword, csrfState);

		mockMvc.perform(protectedPut(
						"/api/access-control/accounts/" + member.getId() + "/system-role-assignments",
						administratorSession,
						csrfState)
						.header("Idempotency-Key", UUID.randomUUID().toString())
						.content(objectMapper.writeValueAsString(Map.of(
								"roleIds", List.of(formalAdministratorRole.getId()),
								"version", 0,
								"reason", "验证正式系统角色分配。"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accountId").value(member.getId().toString()))
				.andExpect(jsonPath("$.assignments[0].roleCode").value("SYSTEM_SECURITY_ADMIN"))
				.andExpect(jsonPath("$.version").value(1));

		mockMvc.perform(protectedPut(
						"/api/access-control/accounts/" + member.getId() + "/system-role-assignments",
						administratorSession,
						csrfState)
						.header("Idempotency-Key", UUID.randomUUID().toString())
						.content(objectMapper.writeValueAsString(Map.of(
								"roleIds", List.of(formalAdministratorRole.getId(), outOfScopeSystemRole.getId()),
								"version", 1,
								"reason", "验证系统角色分配不能间接越权。"))))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("AUTHORIZATION_SCOPE_EXCEEDED"));

		mockMvc.perform(protectedPost("/api/access-control/temporary-grants", administratorSession, csrfState)
					.header("Idempotency-Key", UUID.randomUUID().toString())
					.content(objectMapper.writeValueAsString(Map.of(
							"recipientAccountId", member.getId(),
							"permissionCode", "TEST_HIGH_RISK_TARGET",
							"dataScope", "NAMED_OBJECTS",
							"scopeReferences", "controlled-object-42",
							"startsAt", Instant.now().plusSeconds(90).toString(),
							"endsAt", Instant.now().plusSeconds(3_600).toString(),
							"reason", "验证高敏感授权必须复核。"))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("HIGH_RISK_REVIEW_REQUIRED"));

		Cookie memberSession = login("formal-member", memberPassword, csrfState);
		mockMvc.perform(get("/api/iam/users?page=1&pageSize=10").cookie(memberSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(2));
	}

	@Test
	void highRiskGrantStaysInactiveUntilTheAssignedIndependentReviewerApproves() throws Exception {
		var reviewPermission=permissionItemRepository.saveAndFlush(new PermissionItem(
			AccessControlPermissions.IAM_TEMPORARY_GRANT_REVIEW,null,"独立复核授权","iam.temporary-grant.review",
			PermissionDimension.ACTION,RiskLevel.HIGH,true,PermissionItemStatus.ENABLED));
		rolePermissionGrantRepository.saveAndFlush(grant(reviewPermission));
		String reviewerPassword=generatedPassword();
		var reviewer=userAccountRepository.saveAndFlush(new UserAccount("formal-reviewer","formal-reviewer","独立复核人",
			null,null,null,organizationUnitRepository.findAll().getFirst(),passwordPolicy.hash(reviewerPassword),false,false));
		var reviewRole=accessRoleRepository.saveAndFlush(new AccessRole("TEST_REVIEWER","复核员",AccessRoleType.SYSTEM,
			"仅有独立授权复核能力。",AccessRoleStatus.ENABLED,90));
		rolePermissionGrantRepository.saveAndFlush(new RolePermissionGrant(reviewRole,reviewPermission,DataScope.ALL_ORGANIZATION,null,null));
		systemRoleAssignmentRepository.saveAndFlush(new SystemRoleAssignment(reviewer.getId(),reviewRole,administrator.getId()));
		CsrfState csrf=fetchCsrf();Cookie adminSession=login("formal-admin",administratorPassword,csrf);
		Cookie reviewerSession=login("formal-reviewer",reviewerPassword,csrf);
		Instant start=Instant.now().plusSeconds(90),end=start.plusSeconds(3600);
		String body=objectMapper.writeValueAsString(Map.of("recipientAccountId",member.getId(),"permissionCode","TEST_HIGH_RISK_TARGET",
			"dataScope","NAMED_OBJECTS","scopeReferences","controlled-object-42","startsAt",start.toString(),"endsAt",end.toString(),
			"reason","验证独立复核实际结论。","reviewerAccountId",reviewer.getId()));
		var created=mockMvc.perform(protectedPost("/api/access-control/temporary-grants",adminSession,csrf)
			.header("Idempotency-Key",UUID.randomUUID().toString()).content(body))
			.andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING_REVIEW")).andReturn();
		UUID id=UUID.fromString(objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText());
		assertThat(temporaryGrantRepository.findById(id).orElseThrow().isEffectiveAt(start.plusSeconds(1))).isFalse();
		String decision=objectMapper.writeValueAsString(Map.of("decision","APPROVED","comment","独立确认精确范围和原期限。","version",0));
		mockMvc.perform(protectedPost("/api/access-control/temporary-grants/"+id+"/review",adminSession,csrf)
			.header("Idempotency-Key",UUID.randomUUID().toString()).content(decision)).andExpect(status().isForbidden());
		String key=UUID.randomUUID().toString();
		for(int i=0;i<2;i++)mockMvc.perform(protectedPost("/api/access-control/temporary-grants/"+id+"/review",reviewerSession,csrf)
			.header("Idempotency-Key",key).content(decision)).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("ACTIVE")).andExpect(jsonPath("$.reviewedByAccountId").value(reviewer.getId().toString()))
			.andExpect(jsonPath("$.version").value(1));
		var approved=temporaryGrantRepository.findById(id).orElseThrow();
		assertThat(approved.isEffectiveAt(start.plusSeconds(1))).isTrue();assertThat(approved.isEffectiveAt(end)).isFalse();
		assertThat(approved.getStartsAt()).isEqualTo(start);assertThat(approved.getEndsAt()).isEqualTo(end);
		var second=mockMvc.perform(protectedPost("/api/access-control/temporary-grants",adminSession,csrf)
			.header("Idempotency-Key",UUID.randomUUID().toString()).content(body)).andExpect(status().isCreated()).andReturn();
		String secondId=objectMapper.readTree(second.getResponse().getContentAsString()).get("id").asText();
		var assignment=systemRoleAssignmentRepository.findByAccountIdAndRoleId(administrator.getId(),formalAdministratorRole.getId()).orElseThrow();
		assignment.revoke();systemRoleAssignmentRepository.saveAndFlush(assignment);
		mockMvc.perform(protectedPost("/api/access-control/temporary-grants/"+secondId+"/review",reviewerSession,csrf)
			.header("Idempotency-Key",UUID.randomUUID().toString()).content(decision)).andExpect(status().isForbidden());
		assertThat(temporaryGrantRepository.findById(UUID.fromString(secondId)).orElseThrow().getStatus()).isEqualTo(TemporaryGrantStatus.PENDING_REVIEW);
	}

	@Test
	void roleChangesCannotBypassOriginalLevelByDowngradingOrRemovingAssignments() throws Exception {
		var manage=permissionItemRepository.saveAndFlush(new PermissionItem(AccessControlPermissions.IAM_ROLE_MANAGE,null,
			"维护角色","iam.role.manage",PermissionDimension.ACTION,RiskLevel.HIGH,true,PermissionItemStatus.ENABLED));
		rolePermissionGrantRepository.saveAndFlush(grant(manage));
		var higher=accessRoleRepository.saveAndFlush(new AccessRole("TEST_HIGHER_ROLE","较高级别测试角色",AccessRoleType.SYSTEM,
			"仅用于原级别保护验证。",AccessRoleStatus.ENABLED,150));
		rolePermissionGrantRepository.saveAndFlush(new RolePermissionGrant(higher,
			permissionItemRepository.findByCode(AccessControlPermissions.IAM_USER_READ).orElseThrow(),DataScope.ALL_ORGANIZATION,null,null));
		systemRoleAssignmentRepository.saveAndFlush(new SystemRoleAssignment(member.getId(),higher,administrator.getId()));
		CsrfState csrf=fetchCsrf();Cookie session=login("formal-admin",administratorPassword,csrf);
		mockMvc.perform(protectedPost("/api/access-control/roles",session,csrf).header("Idempotency-Key",UUID.randomUUID().toString())
			.content(objectMapper.writeValueAsString(Map.of("code","TEST_PEER_ROLE","name","同级测试角色","roleType","SYSTEM",
				"responsibilitySummary","不能创建同级角色","delegationLevel",100,"status","DRAFT","grants",List.of()))))
			.andExpect(status().isForbidden());
		mockMvc.perform(patch("/api/access-control/roles/"+higher.getId()).cookie(session,csrf.cookie()).header("X-XSRF-TOKEN",csrf.token())
			.header("Idempotency-Key",UUID.randomUUID().toString()).contentType(MediaType.APPLICATION_JSON)
			.content(objectMapper.writeValueAsString(Map.of("name","试图降级","responsibilitySummary","不能跳过原级别","delegationLevel",10,"version",0,"grants",List.of()))))
			.andExpect(status().isForbidden());
		mockMvc.perform(protectedPost("/api/access-control/roles/"+higher.getId()+"/status",session,csrf)
			.header("Idempotency-Key",UUID.randomUUID().toString()).content(objectMapper.writeValueAsString(Map.of("status","DISABLED","reason","不能停用更高级角色","version",0))))
			.andExpect(status().isForbidden());
		mockMvc.perform(protectedPut("/api/access-control/accounts/"+member.getId()+"/system-role-assignments",session,csrf)
			.header("Idempotency-Key",UUID.randomUUID().toString()).content(objectMapper.writeValueAsString(Map.of("roleIds",List.of(),"reason","空集不能绕过原授权","version",0))))
			.andExpect(status().isForbidden());
		assertThat(accessRoleRepository.findById(higher.getId()).orElseThrow().getDelegationLevel()).isEqualTo(150);
		assertThat(systemRoleAssignmentRepository.findByAccountIdAndRoleId(member.getId(),higher.getId()).orElseThrow().getStatus()).isEqualTo(SystemRoleAssignmentStatus.ACTIVE);
	}

	@Test
	void authorizationWritesFingerprintAllFieldsAndUnsupportedDeletionIsNotAServerFailure() throws Exception {
		var manage=permissionItemRepository.saveAndFlush(new PermissionItem(AccessControlPermissions.IAM_ROLE_MANAGE,null,
			"维护角色","iam.role.manage",PermissionDimension.ACTION,RiskLevel.HIGH,true,PermissionItemStatus.ENABLED));
		rolePermissionGrantRepository.saveAndFlush(grant(manage));
		CsrfState csrf=fetchCsrf(); Cookie session=login("formal-admin",administratorPassword,csrf);
		var input=new java.util.LinkedHashMap<String,Object>(Map.of("code","TEST_REQUEST_ROLE","name","幂等验证角色","roleType","SYSTEM",
			"responsibilitySummary","原职责说明","delegationLevel",10,"status","DRAFT","grants",List.of()));
		String key=UUID.randomUUID().toString();
		for(int i=0;i<2;i++)mockMvc.perform(protectedPost("/api/access-control/roles",session,csrf)
			.header("Idempotency-Key",key).content(objectMapper.writeValueAsString(input))).andExpect(status().isCreated());
		input.put("responsibilitySummary","改变职责说明不能被误认为同一个请求");
		mockMvc.perform(protectedPost("/api/access-control/roles",session,csrf).header("Idempotency-Key",key)
			.content(objectMapper.writeValueAsString(input))).andExpect(status().isConflict());
		assertThat(accessRoleRepository.findByCode("TEST_REQUEST_ROLE").orElseThrow().getResponsibilitySummary()).isEqualTo("原职责说明");
		mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/access-control/roles/"+formalAdministratorRole.getId())
			.cookie(session,csrf.cookie()).header("X-XSRF-TOKEN",csrf.token())).andExpect(status().isMethodNotAllowed()).andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
		assertThat(accessRoleRepository.findById(formalAdministratorRole.getId())).isPresent();
	}

	private RolePermissionGrant grant(PermissionItem permission) {
		return new RolePermissionGrant(
				formalAdministratorRole,
				permission,
				DataScope.ALL_ORGANIZATION,
				null,
				null);
	}

	private CsrfState fetchCsrf() throws Exception {
		MvcResult result = mockMvc.perform(get("/api/auth/csrf"))
				.andExpect(status().isOk())
				.andReturn();
		JsonNode payload = objectMapper.readTree(result.getResponse().getContentAsString());
		Cookie cookie = result.getResponse().getCookie("XSRF-TOKEN");
		assertThat(cookie).isNotNull();
		return new CsrfState(cookie, payload.required("token").asText());
	}

	private Cookie login(String loginName, String password, CsrfState csrfState) throws Exception {
		MvcResult result = mockMvc.perform(loginRequest(loginName, password, csrfState))
				.andExpect(status().isOk())
				.andReturn();
		Cookie sessionCookie = result.getResponse().getCookie("WINH_SESSION");
		assertThat(sessionCookie).isNotNull();
		return sessionCookie;
	}

	private MockHttpServletRequestBuilder loginRequest(String loginName, String password, CsrfState csrfState) throws Exception {
		return post("/api/auth/login")
				.cookie(csrfState.cookie())
				.header("X-XSRF-TOKEN", csrfState.token())
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(Map.of(
						"loginName", loginName,
						"password", password)));
	}

	private MockHttpServletRequestBuilder protectedPost(String path, Cookie sessionCookie, CsrfState csrfState) {
		return post(path)
				.cookie(sessionCookie, csrfState.cookie())
				.header("X-XSRF-TOKEN", csrfState.token())
				.contentType(MediaType.APPLICATION_JSON);
	}

	private MockHttpServletRequestBuilder protectedPut(String path, Cookie sessionCookie, CsrfState csrfState) {
		return put(path)
				.cookie(sessionCookie, csrfState.cookie())
				.header("X-XSRF-TOKEN", csrfState.token())
				.contentType(MediaType.APPLICATION_JSON);
	}

	private String generatedPassword() {
		return "Aa1!" + UUID.randomUUID() + "Z";
	}

	private record CsrfState(Cookie cookie, String token) {
	}
}
