package com.winh.workplan.iam.authorization;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "access_role")
public class AccessRole {

	@Id
	private UUID id;

	@Column(nullable = false, length = 120)
	private String code;

	@Column(nullable = false, length = 120)
	private String name;

	@Enumerated(EnumType.STRING)
	@Column(name = "role_type", nullable = false, length = 24)
	private AccessRoleType roleType;

	@Column(name = "responsibility_summary", nullable = false, length = 1000)
	private String responsibilitySummary;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 24)
	private AccessRoleStatus status;

	@Column(name = "delegation_level", nullable = false)
	private int delegationLevel;

	@Version
	@Column(nullable = false)
	private long version;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected AccessRole() {
	}

	public AccessRole(
			String code,
			String name,
			AccessRoleType roleType,
			String responsibilitySummary,
			AccessRoleStatus status,
			int delegationLevel) {
		this.id = UUID.randomUUID();
		this.code = code;
		this.name = name;
		this.roleType = roleType;
		this.responsibilitySummary = responsibilitySummary;
		this.status = status;
		this.delegationLevel = delegationLevel;
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

	public String getCode() {
		return code;
	}

	public String getName() {
		return name;
	}

	public AccessRoleType getRoleType() {
		return roleType;
	}

	public String getResponsibilitySummary() {
		return responsibilitySummary;
	}

	public AccessRoleStatus getStatus() {
		return status;
	}

	public int getDelegationLevel() {
		return delegationLevel;
	}

	public long getVersion() {
		return version;
	}

	public void update(
			String name,
			String responsibilitySummary,
			int delegationLevel) {
		this.name = name;
		this.responsibilitySummary = responsibilitySummary;
		this.delegationLevel = delegationLevel;
	}

	public void changeStatus(AccessRoleStatus status) {
		this.status = status;
	}
}
