package com.winh.workplan.iam.authorization;

import java.time.Instant;
import java.util.UUID;

import com.winh.workplan.iam.menu.MenuResource;

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
@Table(name = "permission_item")
public class PermissionItem {

	@Id
	private UUID id;

	@Column(nullable = false, length = 120)
	private String code;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "menu_resource_id")
	private MenuResource menuResource;

	@Column(nullable = false, length = 160)
	private String name;

	@Column(name = "action_key", nullable = false, length = 120)
	private String actionKey;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private PermissionDimension dimension;

	@Enumerated(EnumType.STRING)
	@Column(name = "risk_level", nullable = false, length = 24)
	private RiskLevel riskLevel;

	@Column(name = "can_delegate", nullable = false)
	private boolean canDelegate;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 24)
	private PermissionItemStatus status;

	@Version
	@Column(nullable = false)
	private long version;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected PermissionItem() {
	}

	public PermissionItem(
			String code,
			MenuResource menuResource,
			String name,
			String actionKey,
			PermissionDimension dimension,
			RiskLevel riskLevel,
			boolean canDelegate,
			PermissionItemStatus status) {
		this.id = UUID.randomUUID();
		this.code = code;
		this.menuResource = menuResource;
		this.name = name;
		this.actionKey = actionKey;
		this.dimension = dimension;
		this.riskLevel = riskLevel;
		this.canDelegate = canDelegate;
		this.status = status;
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

	public MenuResource getMenuResource() {
		return menuResource;
	}

	public String getName() {
		return name;
	}

	public String getActionKey() {
		return actionKey;
	}

	public PermissionDimension getDimension() {
		return dimension;
	}

	public RiskLevel getRiskLevel() {
		return riskLevel;
	}

	public boolean isCanDelegate() {
		return canDelegate;
	}

	public PermissionItemStatus getStatus() {
		return status;
	}

	public long getVersion() {
		return version;
	}
}
