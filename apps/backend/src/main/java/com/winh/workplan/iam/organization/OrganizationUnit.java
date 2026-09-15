package com.winh.workplan.iam.organization;

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
@Table(name = "org_unit")
public class OrganizationUnit {

	@Id
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "parent_id")
	private OrganizationUnit parent;

	@Column(nullable = false, length = 100)
	private String name;

	@Column(nullable = false, length = 64)
	private String code;

	@Enumerated(EnumType.STRING)
	@Column(name = "unit_type", nullable = false, length = 24)
	private OrganizationUnitType unitType;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 24)
	private OrganizationUnitStatus status;

	@Column(name = "manager_account_id")
	private UUID managerAccountId;

	@Column(name = "sort_order", nullable = false)
	private int sortOrder;

	@Version
	@Column(nullable = false)
	private long version;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	protected OrganizationUnit() {
	}

	public OrganizationUnit(
			String name,
			String code,
			OrganizationUnitType unitType,
			OrganizationUnit parent,
			UUID managerAccountId,
			int sortOrder,
			OrganizationUnitStatus status) {
		this.id = UUID.randomUUID();
		this.name = name;
		this.code = code;
		this.unitType = unitType;
		this.parent = parent;
		this.managerAccountId = managerAccountId;
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

	public OrganizationUnit getParent() {
		return parent;
	}

	public String getName() {
		return name;
	}

	public String getCode() {
		return code;
	}

	public OrganizationUnitType getUnitType() {
		return unitType;
	}

	public OrganizationUnitStatus getStatus() {
		return status;
	}

	public UUID getManagerAccountId() {
		return managerAccountId;
	}

	public int getSortOrder() {
		return sortOrder;
	}

	public long getVersion() {
		return version;
	}

	public void update(
			String name,
			String code,
			OrganizationUnit parent,
			UUID managerAccountId,
			int sortOrder) {
		this.name = name;
		this.code = code;
		this.parent = parent;
		this.managerAccountId = managerAccountId;
		this.sortOrder = sortOrder;
	}

	public void changeStatus(OrganizationUnitStatus nextStatus) {
		this.status = nextStatus;
	}
}
