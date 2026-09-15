package com.winh.workplan.iam.identity;

import java.time.Instant;
import java.util.UUID;

import com.winh.workplan.iam.account.UserAccount;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "account_session")
class AccountSession {

	@Id
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "account_id", nullable = false)
	private UserAccount account;

	@Column(name = "token_hash", nullable = false, length = 64)
	private String tokenHash;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "last_seen_at", nullable = false)
	private Instant lastSeenAt;

	@Column(name = "absolute_expires_at", nullable = false)
	private Instant absoluteExpiresAt;

	@Column(name = "idle_expires_at", nullable = false)
	private Instant idleExpiresAt;

	@Column(name = "revoked_at")
	private Instant revokedAt;

	@Column(name = "revoked_reason", length = 100)
	private String revokedReason;

	protected AccountSession() {
	}

	AccountSession(UserAccount account, String tokenHash, Instant absoluteExpiresAt, Instant idleExpiresAt) {
		this.id = UUID.randomUUID();
		this.account = account;
		this.tokenHash = tokenHash;
		this.absoluteExpiresAt = absoluteExpiresAt;
		this.idleExpiresAt = idleExpiresAt;
	}

	@PrePersist
	void assignTimestamps() {
		Instant now = Instant.now();
		createdAt = now;
		lastSeenAt = now;
	}

	UUID getId() {
		return id;
	}

	UserAccount getAccount() {
		return account;
	}

	String getTokenHash() {
		return tokenHash;
	}

	boolean isActiveAt(Instant now) {
		return revokedAt == null && absoluteExpiresAt.isAfter(now) && idleExpiresAt.isAfter(now);
	}

	void touch(Instant now, int idleMinutes) {
		lastSeenAt = now;
		idleExpiresAt = now.plusSeconds(idleMinutes * 60L);
	}

	void revoke(String reason) {
		if (revokedAt == null) {
			revokedAt = Instant.now();
			revokedReason = reason;
		}
	}
}
