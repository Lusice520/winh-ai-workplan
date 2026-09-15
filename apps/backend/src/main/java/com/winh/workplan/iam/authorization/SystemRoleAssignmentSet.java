package com.winh.workplan.iam.authorization;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * A per-account aggregate version for replace-all system-role assignment
 * requests. Individual assignment rows preserve their own history; this
 * record provides one optimistic-concurrency boundary for the complete set.
 */
@Entity
@Table(name = "system_role_assignment_set")
public class SystemRoleAssignmentSet {

	@Id
	@Column(name = "account_id")
	private UUID accountId;

	@Version
	@Column(nullable = false)
	private long version;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected SystemRoleAssignmentSet() {
	}

	public SystemRoleAssignmentSet(UUID accountId) {
		this.accountId = accountId;
	}

	@PrePersist
	void createTimestamp() {
		if (updatedAt == null) {
			updatedAt = Instant.now();
		}
	}

	public UUID getAccountId() {
		return accountId;
	}

	public long getVersion() {
		return version;
	}

	public void touch() {
		updatedAt = Instant.now();
	}
}
