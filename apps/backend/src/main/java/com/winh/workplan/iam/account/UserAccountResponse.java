package com.winh.workplan.iam.account;

import java.time.Instant;
import java.util.UUID;

public record UserAccountResponse(
		UUID id,
		String loginName,
		String displayName,
		String employeeCode,
		String workEmail,
		String mobilePhone,
		OrganizationReference organizationUnit,
		AccountStatus accountStatus,
		Instant lastSuccessfulLoginAt,
		boolean mustChangePassword,
		boolean bootstrapSystemAdministrator,
		long version) {
}
