package com.winh.workplan.iam.audit;

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
@Table(name = "audit_event")
public class AuditEvent {

	@Id
	private UUID id;

	@Column(name = "event_type", nullable = false, length = 120)
	private String eventType;

	@Column(name = "actor_account_id")
	private UUID actorAccountId;

	@Column(name = "subject_type", nullable = false, length = 100)
	private String subjectType;

	@Column(name = "subject_id")
	private UUID subjectId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 24)
	private AuditOutcome outcome;

	@Column(name = "correlation_id", nullable = false, length = 64)
	private String correlationId;

	@Column(length = 500)
	private String reason;

	@Column(name = "before_summary", columnDefinition = "TEXT")
	private String beforeSummary;

	@Column(name = "after_summary", columnDefinition = "TEXT")
	private String afterSummary;

	@Column(name = "occurred_at", nullable = false)
	private Instant occurredAt;

	protected AuditEvent() {
	}

	AuditEvent(AuditEventCommand command) {
		this.id = UUID.randomUUID();
		this.eventType = command.eventType();
		this.actorAccountId = command.actorAccountId();
		this.subjectType = command.subjectType();
		this.subjectId = command.subjectId();
		this.outcome = command.outcome();
		this.correlationId = command.correlationId();
		this.reason = command.reason();
		this.beforeSummary = command.beforeSummary();
		this.afterSummary = command.afterSummary();
	}

	@PrePersist
	void assignOccurredAt() {
		if (occurredAt == null) {
			occurredAt = Instant.now();
		}
	}
}
