package com.winh.workplan.iam.account;

import java.time.Instant;
import java.util.UUID;

import com.winh.workplan.iam.organization.OrganizationUnit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "user_account")
public class UserAccount {

	@Id
	private UUID id;

	@Column(name = "login_name", nullable = false, length = 100)
	private String loginName;

	@Column(name = "login_name_normalized", nullable = false, length = 100)
	private String loginNameNormalized;

	@Column(name = "display_name", nullable = false, length = 100)
	private String displayName;

	@Column(name = "employee_code", length = 100)
	private String employeeCode;

	@Column(name = "work_email", length = 254)
	private String workEmail;

	@Column(name = "mobile_phone", length = 32)
	private String mobilePhone;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "organization_unit_id", nullable = false)
	private OrganizationUnit organizationUnit;

	@Enumerated(EnumType.STRING)
	@Column(name = "account_status", nullable = false, length = 24)
	private AccountStatus accountStatus;

	@Column(name = "password_hash", nullable = false, length = 255)
	private String passwordHash;

	@Column(name = "failed_login_count", nullable = false)
	private int failedLoginCount;

	@Column(name = "last_failed_login_at")
	private Instant lastFailedLoginAt;

	@Column(name = "locked_until")
	private Instant lockedUntil;

	@Column(name = "last_successful_login_at")
	private Instant lastSuccessfulLoginAt;

	@Column(name = "must_change_password", nullable = false)
	private boolean mustChangePassword;

	@Column(name = "bootstrap_system_administrator", nullable = false)
	private boolean bootstrapSystemAdministrator;

	@Version
	@Column(nullable = false)
	private long version;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected UserAccount() {
	}

	public UserAccount(
			String loginName,
			String loginNameNormalized,
			String displayName,
			String employeeCode,
			String workEmail,
			String mobilePhone,
			OrganizationUnit organizationUnit,
			String passwordHash,
			boolean mustChangePassword,
			boolean bootstrapSystemAdministrator) {
		this.id = UUID.randomUUID();
		this.loginName = loginName;
		this.loginNameNormalized = loginNameNormalized;
		this.displayName = displayName;
		this.employeeCode = employeeCode;
		this.workEmail = workEmail;
		this.mobilePhone = mobilePhone;
		this.organizationUnit = organizationUnit;
		this.accountStatus = AccountStatus.ENABLED;
		this.passwordHash = passwordHash;
		this.mustChangePassword = mustChangePassword;
		this.bootstrapSystemAdministrator = bootstrapSystemAdministrator;
	}

	@PrePersist
	void createTimestamps() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	@PreUpdate
	void updateTimestamp() {
		updatedAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public String getLoginName() {
		return loginName;
	}

	public String getLoginNameNormalized() {
		return loginNameNormalized;
	}

	public String getDisplayName() {
		return displayName;
	}

	public String getEmployeeCode() {
		return employeeCode;
	}

	public String getWorkEmail() {
		return workEmail;
	}

	public String getMobilePhone() {
		return mobilePhone;
	}

	public OrganizationUnit getOrganizationUnit() {
		return organizationUnit;
	}

	public AccountStatus getAccountStatus() {
		return accountStatus;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public int getFailedLoginCount() {
		return failedLoginCount;
	}

	public Instant getLastFailedLoginAt() {
		return lastFailedLoginAt;
	}

	public Instant getLockedUntil() {
		return lockedUntil;
	}

	public Instant getLastSuccessfulLoginAt() {
		return lastSuccessfulLoginAt;
	}

	public boolean isMustChangePassword() {
		return mustChangePassword;
	}

	public boolean isBootstrapSystemAdministrator() {
		return bootstrapSystemAdministrator;
	}

	public long getVersion() {
		return version;
	}

	public void updateProfile(
			String displayName,
			String employeeCode,
			String workEmail,
			String mobilePhone) {
		this.displayName = displayName;
		this.employeeCode = employeeCode;
		this.workEmail = workEmail;
		this.mobilePhone = mobilePhone;
	}

	public void moveTo(OrganizationUnit targetOrganizationUnit) {
		this.organizationUnit = targetOrganizationUnit;
	}

	public void changeStatus(AccountStatus nextStatus) {
		this.accountStatus = nextStatus;
		this.lockedUntil = null;
	}

	public void recordFailedLogin(Instant occurredAt, Instant lockUntil) {
		this.failedLoginCount++;
		this.lastFailedLoginAt = occurredAt;
		if (lockUntil != null) {
			this.accountStatus = AccountStatus.LOCKED;
			this.lockedUntil = lockUntil;
		}
	}

	public void resetFailedLoginAttempts() {
		this.failedLoginCount = 0;
		this.lastFailedLoginAt = null;
	}

	public void unlockAfterExpiry() {
		this.accountStatus = AccountStatus.ENABLED;
		this.lockedUntil = null;
		resetFailedLoginAttempts();
	}

	public void recordSuccessfulLogin(Instant occurredAt) {
		resetFailedLoginAttempts();
		this.lastSuccessfulLoginAt = occurredAt;
	}

	public void replacePassword(String nextPasswordHash, boolean requirePasswordChange) {
		this.passwordHash = nextPasswordHash;
		this.mustChangePassword = requirePasswordChange;
	}
}
