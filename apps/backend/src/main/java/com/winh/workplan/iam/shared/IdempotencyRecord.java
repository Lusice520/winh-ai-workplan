package com.winh.workplan.iam.shared;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "idempotency_record")
class IdempotencyRecord {

	@Id
	private UUID id;

	@Column(name = "operation_scope", nullable = false, length = 120)
	private String operationScope;

	@Column(name = "idempotency_key", nullable = false, length = 160)
	private String idempotencyKey;

	@Column(name = "request_hash", nullable = false, length = 64)
	private String requestHash;

	@Column(name = "target_id")
	private UUID targetId;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "completed_at")
	private Instant completedAt;

	protected IdempotencyRecord() {
	}

	IdempotencyRecord(String operationScope, String idempotencyKey, String requestHash) {
		this.id = UUID.randomUUID();
		this.operationScope = operationScope;
		this.idempotencyKey = idempotencyKey;
		this.requestHash = requestHash;
	}

	@PrePersist
	void assignCreatedAt() {
		if (createdAt == null) {
			createdAt = Instant.now();
		}
	}

	UUID getTargetId() {
		return targetId;
	}

	String getRequestHash() {
		return requestHash;
	}

	void complete(UUID targetId) {
		this.targetId = targetId;
		this.completedAt = Instant.now();
	}
}
