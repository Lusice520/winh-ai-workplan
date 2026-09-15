package com.winh.workplan.iam.organization;

import java.util.List;
import java.util.UUID;

public record OrganizationUnitResponse(
		UUID id,
		UUID parentId,
		String name,
		String code,
		OrganizationUnitType unitType,
		OrganizationUnitStatus status,
		UUID managerAccountId,
		int sortOrder,
		long version,
		long directUserCount,
		List<OrganizationUnitResponse> children) {

	public static OrganizationUnitResponse leaf(OrganizationUnit unit, long directUserCount) {
		return new OrganizationUnitResponse(
				unit.getId(),
				unit.getParent() == null ? null : unit.getParent().getId(),
				unit.getName(),
				unit.getCode(),
				unit.getUnitType(),
				unit.getStatus(),
				unit.getManagerAccountId(),
				unit.getSortOrder(),
				unit.getVersion(),
				directUserCount,
				List.of());
	}
}
