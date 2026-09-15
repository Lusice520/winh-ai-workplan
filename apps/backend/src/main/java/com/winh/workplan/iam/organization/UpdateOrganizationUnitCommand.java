package com.winh.workplan.iam.organization;

import java.util.UUID;

public record UpdateOrganizationUnitCommand(
		String name,
		String code,
		UUID parentId,
		UUID managerAccountId,
		int sortOrder,
		long version) {
}
