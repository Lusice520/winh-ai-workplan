package com.winh.workplan.iam.account;

public record UpdateUserCommand(
		String displayName,
		String employeeCode,
		String workEmail,
		String mobilePhone,
		long version) {
}
