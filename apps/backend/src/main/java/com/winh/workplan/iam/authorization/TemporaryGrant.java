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
import jakarta.persistence.Version;

@Entity
@Table(name = "temporary_grant")
public class TemporaryGrant {

	@Id
	private UUID id;

	@Column(name = "recipient_account_id", nullable = false)
	private UUID recipientAccountId;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "permission_item_id", nullable = false)
	private PermissionItem permissionItem;

	@Enumerated(EnumType.STRING)
	@Column(name = "data_scope", nullable = false, length = 40)
	private DataScope dataScope;

	@Column(name = "scope_references", columnDefinition = "TEXT")
	private String scopeReferences;

	@Column(name = "starts_at", nullable = false)
	private Instant startsAt;

	@Column(name = "ends_at", nullable = false)
	private Instant endsAt;

	@Column(nullable = false, length = 1000)
	private String reason;

	@Column(name = "reviewer_account_id")
	private UUID reviewerAccountId;

	@Column(name = "created_by_account_id")
	private UUID createdByAccountId;

	@Column(name = "reviewed_by_account_id")
	private UUID reviewedByAccountId;

	@Column(name = "reviewed_at")
	private Instant reviewedAt;

	@Column(name = "review_comment", length = 1000)
	private String reviewComment;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 24)
	private TemporaryGrantStatus status;

	@Column(name = "revoked_at")
	private Instant revokedAt;

	@Column(name = "revoked_by_account_id")
	private UUID revokedByAccountId;

	@Column(name = "revoke_reason", length = 1000)
	private String revokeReason;

	@Version
	@Column(nullable = false)
	private long version;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected TemporaryGrant() {
	}

	public TemporaryGrant(
			UUID recipientAccountId,
			PermissionItem permissionItem,
			DataScope dataScope,
			String scopeReferences,
			Instant startsAt,
			Instant endsAt,
			String reason,
			UUID reviewerAccountId) {
		this(recipientAccountId,permissionItem,dataScope,scopeReferences,startsAt,endsAt,reason,reviewerAccountId,null);
	}

	public TemporaryGrant(UUID recipientAccountId,PermissionItem permissionItem,DataScope dataScope,
		String scopeReferences,Instant startsAt,Instant endsAt,String reason,UUID reviewerAccountId,UUID createdByAccountId) {
		this.id = UUID.randomUUID();
		this.recipientAccountId = recipientAccountId;
		this.permissionItem = permissionItem;
		this.dataScope = dataScope;
		this.scopeReferences = scopeReferences;
		this.startsAt = startsAt;
		this.endsAt = endsAt;
		this.reason = reason;
		this.reviewerAccountId = reviewerAccountId;
		this.createdByAccountId = createdByAccountId;
		this.status = permissionItem.getRiskLevel() == RiskLevel.HIGH ? TemporaryGrantStatus.PENDING_REVIEW : TemporaryGrantStatus.ACTIVE;
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

	public UUID getRecipientAccountId() {
		return recipientAccountId;
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

	public Instant getStartsAt() {
		return startsAt;
	}

	public Instant getEndsAt() {
		return endsAt;
	}

	public String getReason() {
		return reason;
	}

	public UUID getReviewerAccountId() {
		return reviewerAccountId;
	}

	public TemporaryGrantStatus getStatus() {
		return status;
	}

	public UUID getCreatedByAccountId() { return createdByAccountId; }
	public UUID getReviewedByAccountId() { return reviewedByAccountId; }
	public Instant getReviewedAt() { return reviewedAt; }
	public String getReviewComment() { return reviewComment; }
	public void review(boolean approved,UUID reviewer,String comment,Instant at) {
		status=approved?TemporaryGrantStatus.ACTIVE:TemporaryGrantStatus.REJECTED;
		reviewedByAccountId=reviewer;reviewComment=comment;reviewedAt=at;
	}

	public Instant getRevokedAt() {
		return revokedAt;
	}

	public UUID getRevokedByAccountId() {
		return revokedByAccountId;
	}

	public String getRevokeReason() {
		return revokeReason;
	}

	public long getVersion() {
		return version;
	}

	public boolean isEffectiveAt(Instant instant) {
		return status == TemporaryGrantStatus.ACTIVE
				&& !startsAt.isAfter(instant)
				&& endsAt.isAfter(instant);
	}

	public void revoke(UUID revokedByAccountId, String revokeReason, Instant revokedAt) {
		status = TemporaryGrantStatus.REVOKED;
		this.revokedByAccountId = revokedByAccountId;
		this.revokeReason = revokeReason;
		this.revokedAt = revokedAt;
	}

	public void expire() {
		status = TemporaryGrantStatus.EXPIRED;
	}
}
