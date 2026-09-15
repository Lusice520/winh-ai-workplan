package com.winh.workplan.iam.organization;

import java.util.UUID;

public record CreateOrganizationUnitCommand(
		String name,
		String code,
		OrganizationUnitType unitType,
		UUID parentId,
		UUID managerAccountId,
		int sortOrder,
		OrganizationUnitStatus status) {
}
