package com.winh.workplan.iam.account;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "account_status_history")
class AccountStatusHistory {

	@Id
	private UUID id;

	@Column(name = "account_id", nullable = false)
	private UUID accountId;

	@Enumerated(EnumType.STRING)
	@Column(name = "previous_status", length = 24)
	private AccountStatus previousStatus;

	@Enumerated(EnumType.STRING)
	@Column(name = "current_status", nullable = false, length = 24)
	private AccountStatus currentStatus;

	@Column(nullable = false, length = 500)
	private String reason;

	@Column(name = "actor_account_id")
	private UUID actorAccountId;

	@Column(name = "occurred_at", nullable = false)
	private Instant occurredAt;

	@Column(name = "correlation_id", nullable = false, length = 64)
	private String correlationId;

	protected AccountStatusHistory() {
	}

	AccountStatusHistory(
			UUID accountId,
			AccountStatus previousStatus,
			AccountStatus currentStatus,
			String reason,
			UUID actorAccountId,
			String correlationId) {
		this.id = UUID.randomUUID();
		this.accountId = accountId;
		this.previousStatus = previousStatus;
		this.currentStatus = currentStatus;
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
