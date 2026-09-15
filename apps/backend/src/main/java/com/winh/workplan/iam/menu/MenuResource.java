package com.winh.workplan.iam.menu;

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
@Table(name = "menu_resource")
public class MenuResource {

	@Id
	private UUID id;

	@Column(nullable = false, length = 120)
	private String code;

	@Enumerated(EnumType.STRING)
	@Column(name = "resource_type", nullable = false, length = 24)
	private MenuResourceType resourceType;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "parent_id")
	private MenuResource parent;

	@Column(nullable = false, length = 120)
	private String name;

	@Column(name = "route_key", length = 120)
	private String routeKey;

	@Column(name = "action_key", length = 120)
	private String actionKey;

	@Column(name = "icon_key", length = 80)
	private String iconKey;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 24)
	private MenuResourceStatus status;

	@Version
	@Column(nullable = false)
	private long version;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected MenuResource() {
	}

	public MenuResource(
			String code,
			MenuResourceType resourceType,
			MenuResource parent,
			String name,
			String routeKey,
			String actionKey,
			String iconKey,
			int sortOrder,
			MenuResourceStatus status) {
		this.id = UUID.randomUUID();
		this.code = code;
		this.resourceType = resourceType;
		this.parent = parent;
		this.name = name;
		this.routeKey = routeKey;
		this.actionKey = actionKey;
		this.iconKey = iconKey;
		this.sortOrder = sortOrder;
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

	public MenuResourceType getResourceType() {
		return resourceType;
	}

	public MenuResource getParent() {
		return parent;
	}

	public String getName() {
		return name;
	}

	public String getRouteKey() {
		return routeKey;
	}

	public String getActionKey() {
		return actionKey;
	}

	public String getIconKey() {
		return iconKey;
	}

	public int getSortOrder() {
		return sortOrder;
	}

	public MenuResourceStatus getStatus() {
		return status;
	}

	public long getVersion() {
		return version;
	}

	public void update(
			MenuResource parent,
			String name,
			String routeKey,
			String actionKey,
			String iconKey,
			int sortOrder) {
		this.parent = parent;
		this.name = name;
		this.routeKey = routeKey;
		this.actionKey = actionKey;
		this.iconKey = iconKey;
		this.sortOrder = sortOrder;
	}

	public void changeStatus(MenuResourceStatus status) {
		this.status = status;
	}
}
