package com.winh.workplan.iam.account;

import java.util.Set;
import java.util.UUID;

public record UserDirectoryQuery(
		int page,
		int pageSize,
		String keyword,
		UUID organizationUnitId,
		boolean includeDescendants,
		Set<AccountStatus> statuses) {
}
