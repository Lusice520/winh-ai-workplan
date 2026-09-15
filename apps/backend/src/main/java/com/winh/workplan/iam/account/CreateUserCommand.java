package com.winh.workplan.iam.account;

import java.util.UUID;

public record CreateUserCommand(
		String loginName,
		String displayName,
		String employeeCode,
		String workEmail,
		String mobilePhone,
		UUID organizationUnitId,
		String temporaryPassword) {
}
