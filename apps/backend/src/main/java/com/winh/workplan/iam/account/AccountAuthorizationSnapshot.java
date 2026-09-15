package com.winh.workplan.iam.account;

import java.util.UUID;

public record AccountAuthorizationSnapshot(
		UUID accountId,
		String loginName,
		String displayName,
		AccountStatus accountStatus,
		UUID organizationUnitId,
		boolean bootstrapSystemAdministrator) {
}
