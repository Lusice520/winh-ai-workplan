package com.winh.workplan.iam.account;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "account_organization_history")
class AccountOrganizationHistory {

	@Id
	private UUID id;

	@Column(name = "account_id", nullable = false)
	private UUID accountId;

	@Column(name = "previous_organization_unit_id")
	private UUID previousOrganizationUnitId;

	@Column(name = "current_organization_unit_id", nullable = false)
	private UUID currentOrganizationUnitId;

	@Column(nullable = false, length = 500)
	private String reason;

	@Column(name = "actor_account_id")
	private UUID actorAccountId;

	@Column(name = "occurred_at", nullable = false)
	private Instant occurredAt;

	@Column(name = "correlation_id", nullable = false, length = 64)
	private String correlationId;

	protected AccountOrganizationHistory() {
	}

	AccountOrganizationHistory(
			UUID accountId,
			UUID previousOrganizationUnitId,
			UUID currentOrganizationUnitId,
			String reason,
			UUID actorAccountId,
			String correlationId) {
		this.id = UUID.randomUUID();
		this.accountId = accountId;
		this.previousOrganizationUnitId = previousOrganizationUnitId;
		this.currentOrganizationUnitId = currentOrganizationUnitId;
		this.reason = reason;
		this.actorAccountId = actorAccountId;
		this.correlationId = correlationId;
	}

	@PrePersist
	void assignOccurredAt() {
		if (occurredAt == null) {
			occurredAt = Instant.now();
		}
	}
}
