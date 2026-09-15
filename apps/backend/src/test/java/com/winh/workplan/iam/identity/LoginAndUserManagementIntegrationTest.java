package com.winh.workplan.iam.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.winh.workplan.iam.account.AccountStatus;
import com.winh.workplan.iam.account.UserAccount;
import com.winh.workplan.iam.account.UserAccountRepository;
import com.winh.workplan.iam.authorization.*;
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
class LoginAndUserManagementIntegrationTest {

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
	@Autowired private AccessRoleRepository accessRoleRepository;
	@Autowired private PermissionItemRepository permissionItemRepository;
	@Autowired private RolePermissionGrantRepository rolePermissionGrantRepository;
	@Autowired private SystemRoleAssignmentRepository systemRoleAssignmentRepository;

	private String administratorPassword;
	private UserAccount administrator;

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

		OrganizationUnit rootOrganization = organizationUnitRepository.saveAndFlush(new OrganizationUnit(
				"验证组织",
				"TEST-ROOT",
				OrganizationUnitType.COMPANY,
				null,
				null,
				0,
				OrganizationUnitStatus.ENABLED));
		administratorPassword = generatedPassword();
		administrator = userAccountRepository.saveAndFlush(new UserAccount(
				"test-admin",
				"test-admin",
				"验证管理员",
				null,
				null,
				null,
				rootOrganization,
				passwordPolicy.hash(administratorPassword),
				false,
				true));
		// Authentication metadata alone grants nothing; tests exercise actual persisted role grants.
		var role = accessRoleRepository.saveAndFlush(new AccessRole("SYSTEM_SECURITY_ADMIN", "验证正式安全管理员",
			AccessRoleType.SYSTEM, "账号生命周期验证", AccessRoleStatus.ENABLED, 100));
		for (String code : java.util.List.of(AccessControlPermissions.IAM_USER_READ, AccessControlPermissions.IAM_USER_MANAGE)) {
			var permission = permissionItemRepository.saveAndFlush(new PermissionItem(code, null, code, code.toLowerCase(),
				PermissionDimension.ACTION, RiskLevel.NORMAL, true, PermissionItemStatus.ENABLED));
			rolePermissionGrantRepository.saveAndFlush(new RolePermissionGrant(role, permission, DataScope.ALL_ORGANIZATION, null, null));
		}
		systemRoleAssignmentRepository.saveAndFlush(new SystemRoleAssignment(administrator.getId(), role, administrator.getId()));
	}

	@Test
	void temporaryPasswordAccountsCannotAccessBusinessApisBeforeChangingPassword() throws Exception {
		String password = generatedPassword();
		userAccountRepository.saveAndFlush(new UserAccount("temporary-business", "temporary-business",
				"临时业务验证账号", null, null, null, administrator.getOrganizationUnit(),
				passwordPolicy.hash(password), true, false));
		CsrfState csrf = fetchCsrf();
		Cookie session = login("temporary-business", password, csrf);
		for (String endpoint : java.util.List.of("/api/crm/customers", "/api/projects", "/api/requirements", "/api/business/people")) {
			mockMvc.perform(get(endpoint).cookie(session))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
		}
		mockMvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isOk());
	}

	@Test
	void bootstrapAccountWithFormalRoleCanLoginAndCreateAUserThroughTheProtectedApi() throws Exception {
		CsrfState csrfState = fetchCsrf();
		Cookie sessionCookie = login("test-admin", administratorPassword, csrfState);

		mockMvc.perform(get("/api/auth/me").cookie(sessionCookie))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.loginName").value("test-admin"))
				.andExpect(jsonPath("$.bootstrapSystemAdministrator").value(true));

		mockMvc.perform(get("/api/iam/users?page=1&pageSize=10").cookie(sessionCookie))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.total").value(1))
				.andExpect(jsonPath("$.items[0].loginName").value("test-admin"));

		UUID organizationUnitId = administrator.getOrganizationUnit().getId();
		mockMvc.perform(protectedPost("/api/iam/users", sessionCookie, csrfState)
					.content(objectMapper.writeValueAsString(Map.of(
							"loginName", "new-user",
							"displayName", "新建用户",
							"employeeCode", "E-1001",
							"workEmail", "new-user@example.test",
							"organizationUnitId", organizationUnitId,
							"temporaryPassword", generatedPassword()))))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.loginName").value("new-user"))
				.andExpect(jsonPath("$.mustChangePassword").value(true))
				.andExpect(jsonPath("$.bootstrapSystemAdministrator").value(false));
	}

	@Test
	void fiveFailedLoginsLockTheAccountWithoutRevealingWhetherThePasswordWasCorrect() throws Exception {
		CsrfState csrfState = fetchCsrf();
		for (int failure = 0; failure < 5; failure++) {
			mockMvc.perform(loginRequest("test-admin", generatedPassword(), csrfState))
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));
		}

		mockMvc.perform(loginRequest("test-admin", administratorPassword, csrfState))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTHENTICATION_FAILED"));

		UserAccount lockedAccount = userAccountRepository.findById(administrator.getId()).orElseThrow();
		assertThat(lockedAccount.getAccountStatus()).isEqualTo(AccountStatus.LOCKED);
		assertThat(lockedAccount.getLockedUntil()).isNotNull();
	}

	@Test
	void lastBootstrapAdministratorCannotBeDisabled() throws Exception {
		CsrfState csrfState = fetchCsrf();
		Cookie sessionCookie = login("test-admin", administratorPassword, csrfState);
		UserAccount currentAdministrator = userAccountRepository.findById(administrator.getId()).orElseThrow();

		mockMvc.perform(protectedPost(
						"/api/iam/users/" + administrator.getId() + "/status-transitions",
						sessionCookie,
						csrfState)
						.header("Idempotency-Key", UUID.randomUUID().toString())
						.content(objectMapper.writeValueAsString(Map.of(
								"targetStatus", "DISABLED",
								"reason", "验证最后初始化管理员保护。",
								"version", currentAdministrator.getVersion()))))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("LAST_BOOTSTRAP_ADMIN_PROTECTED"));

		assertThat(userAccountRepository.findById(administrator.getId()).orElseThrow().getAccountStatus())
				.isEqualTo(AccountStatus.ENABLED);
	}

	@Test
	void disablingAnAccountRevokesItsExistingSession() throws Exception {
		OrganizationUnit rootOrganization = administrator.getOrganizationUnit();
		String memberPassword = generatedPassword();
		UserAccount member = userAccountRepository.saveAndFlush(new UserAccount(
				"test-member",
				"test-member",
				"验证成员",
				null,
				null,
				null,
				rootOrganization,
				passwordPolicy.hash(memberPassword),
				false,
				false));
		CsrfState csrfState = fetchCsrf();
		Cookie memberSession = login("test-member", memberPassword, csrfState);
		Cookie administratorSession = login("test-admin", administratorPassword, csrfState);
		UserAccount currentMember = userAccountRepository.findById(member.getId()).orElseThrow();

		mockMvc.perform(protectedPost(
						"/api/iam/users/" + member.getId() + "/status-transitions",
						administratorSession,
						csrfState)
						.header("Idempotency-Key", UUID.randomUUID().toString())
						.content(objectMapper.writeValueAsString(Map.of(
								"targetStatus", "DISABLED",
								"reason", "验证停用后撤销会话。",
								"version", currentMember.getVersion()))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accountStatus").value("DISABLED"));

		mockMvc.perform(get("/api/auth/me").cookie(memberSession))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void missingIdempotencyKeyReturnsAFieldLevelBadRequestInsteadOfAnInternalError() throws Exception {
		CsrfState csrfState = fetchCsrf();
		Cookie sessionCookie = login("test-admin", administratorPassword, csrfState);
		UserAccount currentAdministrator = userAccountRepository.findById(administrator.getId()).orElseThrow();

		mockMvc.perform(protectedPost(
						"/api/iam/users/" + administrator.getId() + "/status-transitions",
						sessionCookie,
						csrfState)
						.content(objectMapper.writeValueAsString(Map.of(
								"targetStatus", "ENABLED",
								"reason", "验证必填幂等键。",
								"version", currentAdministrator.getVersion()))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
				.andExpect(jsonPath("$.fieldErrors[0].field").value("Idempotency-Key"));
	}

	@Test
	void missingCsrfTokenReturnsARecoverableValidationProblemInsteadOfAnAuthorizationClaim() throws Exception {
		CsrfState csrfState = fetchCsrf();
		Cookie sessionCookie = login("test-admin", administratorPassword, csrfState);

		mockMvc.perform(post("/api/iam/users")
					.cookie(sessionCookie, csrfState.cookie())
					.contentType(MediaType.APPLICATION_JSON)
					.content("{}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("CSRF_VALIDATION_FAILED"))
				.andExpect(jsonPath("$.message").value("请求校验已失效，请再次提交；如仍失败，请刷新页面后重试。"));
	}

	@Test
	void nonBootstrapAccountStillReceivesAnAuthorizationDeniedProblemForIamManagement() throws Exception {
		String memberPassword = generatedPassword();
		userAccountRepository.saveAndFlush(new UserAccount(
				"test-member",
				"test-member",
				"验证成员",
				null,
				null,
				null,
				administrator.getOrganizationUnit(),
				passwordPolicy.hash(memberPassword),
				false,
				false));
		CsrfState csrfState = fetchCsrf();
		Cookie sessionCookie = login("test-member", memberPassword, csrfState);

		mockMvc.perform(get("/api/iam/users?page=1&pageSize=10").cookie(sessionCookie))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
				.andExpect(jsonPath("$.message").value("当前账号没有执行该操作的权限。"));
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
				.andExpect(jsonPath("$.loginName").value(loginName))
				.andReturn();
		Cookie sessionCookie = result.getResponse().getCookie("WINH_SESSION");
		assertThat(sessionCookie).isNotNull();
		assertThat(sessionCookie.isHttpOnly()).isTrue();
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

	private String generatedPassword() {
		return "Aa1!" + UUID.randomUUID() + "Z";
	}

	private record CsrfState(Cookie cookie, String token) {
	}
}
