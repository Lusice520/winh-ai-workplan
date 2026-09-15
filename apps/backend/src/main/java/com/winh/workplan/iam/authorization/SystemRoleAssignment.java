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
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "system_role_assignment")
public class SystemRoleAssignment {

	@Id
	private UUID id;

	@Column(name = "account_id", nullable = false)
	private UUID accountId;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "role_id", nullable = false)
	private AccessRole role;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 24)
	private SystemRoleAssignmentStatus status;

	@Column(name = "assigned_by_account_id")
	private UUID assignedByAccountId;

	@Column(name = "assigned_at", nullable = false)
	private Instant assignedAt;

	@Version
	@Column(nullable = false)
	private long version;

	protected SystemRoleAssignment() {
	}

	public SystemRoleAssignment(UUID accountId, AccessRole role, UUID assignedByAccountId) {
		this.id = UUID.randomUUID();
		this.accountId = accountId;
		this.role = role;
		this.status = SystemRoleAssignmentStatus.ACTIVE;
		this.assignedByAccountId = assignedByAccountId;
	}

	@PrePersist
	void assignTimestamp() {
		assignedAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public UUID getAccountId() {
		return accountId;
	}

	public AccessRole getRole() {
		return role;
	}

	public SystemRoleAssignmentStatus getStatus() {
		return status;
	}

	public UUID getAssignedByAccountId() {
		return assignedByAccountId;
	}

	public Instant getAssignedAt() {
		return assignedAt;
	}

	public long getVersion() {
		return version;
	}

	public void revoke() {
		status = SystemRoleAssignmentStatus.REVOKED;
	}

	public void activate(UUID assignedByAccountId) {
		status = SystemRoleAssignmentStatus.ACTIVE;
		this.assignedByAccountId = assignedByAccountId;
		this.assignedAt = Instant.now();
	}
}
