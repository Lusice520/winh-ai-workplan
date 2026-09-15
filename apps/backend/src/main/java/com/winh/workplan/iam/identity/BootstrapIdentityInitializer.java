package com.winh.workplan.iam.identity;

import com.winh.workplan.iam.account.UserAccount;
import com.winh.workplan.iam.account.UserAccountRepository;
import com.winh.workplan.iam.authorization.AccessControlBootstrapProvisioner;
import com.winh.workplan.iam.audit.AuditEventCommand;
import com.winh.workplan.iam.audit.AuditOutcome;
import com.winh.workplan.iam.audit.AuditRecorder;
import com.winh.workplan.iam.organization.OrganizationUnit;
import com.winh.workplan.iam.organization.OrganizationUnitRepository;
import com.winh.workplan.iam.organization.OrganizationUnitStatus;
import com.winh.workplan.iam.organization.OrganizationUnitType;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Component
class BootstrapIdentityInitializer implements ApplicationRunner {

	private final BootstrapProperties bootstrapProperties;
	private final OrganizationUnitRepository organizationUnitRepository;
	private final UserAccountRepository userAccountRepository;
	private final PasswordPolicy passwordPolicy;
	private final AuditRecorder auditRecorder;
	private final AccessControlBootstrapProvisioner accessControlBootstrapProvisioner;

	BootstrapIdentityInitializer(
			BootstrapProperties bootstrapProperties,
			OrganizationUnitRepository organizationUnitRepository,
			UserAccountRepository userAccountRepository,
			PasswordPolicy passwordPolicy,
			AuditRecorder auditRecorder,
			AccessControlBootstrapProvisioner accessControlBootstrapProvisioner) {
		this.bootstrapProperties = bootstrapProperties;
		this.organizationUnitRepository = organizationUnitRepository;
		this.userAccountRepository = userAccountRepository;
		this.passwordPolicy = passwordPolicy;
		this.auditRecorder = auditRecorder;
		this.accessControlBootstrapProvisioner = accessControlBootstrapProvisioner;
	}

	@Override
	@Transactional
	public void run(ApplicationArguments args) {
		if (!bootstrapProperties.isEnabled() || userAccountRepository.count() > 0) {
			return;
		}
		if (!StringUtils.hasText(bootstrapProperties.getAdminPassword())) {
			throw new IllegalStateException(
					"空数据库首次启动需要在已忽略的 .env 设置 APP_BOOTSTRAP_ADMIN_PASSWORD，系统不会创建默认密码。");
		}

		OrganizationUnit rootOrganization = new OrganizationUnit(
				bootstrapProperties.getOrganizationName().trim(),
				"LOCAL-ROOT",
				OrganizationUnitType.COMPANY,
				null,
				null,
				0,
				OrganizationUnitStatus.ENABLED);
		organizationUnitRepository.save(rootOrganization);

		String loginName = bootstrapProperties.getAdminLogin().trim();
		UserAccount admin = new UserAccount(
				loginName,
				loginName.toLowerCase(java.util.Locale.ROOT),
				bootstrapProperties.getAdminDisplayName().trim(),
				null,
				null,
				null,
				rootOrganization,
				passwordPolicy.hash(bootstrapProperties.getAdminPassword()),
				false,
				true);
		UserAccount savedAdmin = userAccountRepository.save(admin);
		accessControlBootstrapProvisioner.ensureBootstrapAdministratorAssignment(savedAdmin.getId());
		auditRecorder.record(new AuditEventCommand(
				"BOOTSTRAP_ADMIN_CREATED",
				savedAdmin.getId(),
				"USER_ACCOUNT",
				savedAdmin.getId(),
				AuditOutcome.SUCCEEDED,
				"bootstrap",
				"空库初始化",
				null,
				"初始化系统管理员与根组织已创建"));
	}
}
