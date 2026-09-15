package com.winh.workplan.iam.identity;

import java.util.UUID;

public record CurrentSessionResponse(
		UUID accountId,
		String loginName,
		String displayName,
		boolean mustChangePassword,
		boolean bootstrapSystemAdministrator) {

	static CurrentSessionResponse from(SessionPrincipal principal) {
		return new CurrentSessionResponse(
				principal.accountId(),
				principal.loginName(),
				principal.displayName(),
				principal.mustChangePassword(),
				principal.bootstrapSystemAdministrator());
	}
}
