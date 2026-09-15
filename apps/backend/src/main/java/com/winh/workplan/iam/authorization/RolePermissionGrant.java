package com.winh.workplan.iam.authorization;

import java.time.Instant;
import java.util.UUID;

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

@Entity
@Table(name = "role_permission_grant")
public class RolePermissionGrant {

	@Id
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "role_id", nullable = false)
	private AccessRole role;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "permission_item_id", nullable = false)
	private PermissionItem permissionItem;

	@Enumerated(EnumType.STRING)
	@Column(name = "data_scope", nullable = false, length = 40)
	private DataScope dataScope;

	@Column(name = "scope_references", columnDefinition = "TEXT")
	private String scopeReferences;

	@Column(name = "condition_summary", length = 1000)
	private String conditionSummary;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected RolePermissionGrant() {
	}

	public RolePermissionGrant(
			AccessRole role,
			PermissionItem permissionItem,
			DataScope dataScope,
			String scopeReferences,
			String conditionSummary) {
		this.id = UUID.randomUUID();
		this.role = role;
		this.permissionItem = permissionItem;
		this.dataScope = dataScope;
		this.scopeReferences = scopeReferences;
		this.conditionSummary = conditionSummary;
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

	public AccessRole getRole() {
		return role;
	}

	public PermissionItem getPermissionItem() {
		return permissionItem;
	}

	public DataScope getDataScope() {
		return dataScope;
	}

	public String getScopeReferences() {
		return scopeReferences;
	}

	public String getConditionSummary() {
		return conditionSummary;
	}
}
