package com.winh.workplan.iam.identity;

import java.io.Serializable;
import java.util.UUID;

public record SessionPrincipal(
		UUID accountId,
		String loginName,
		String displayName,
		boolean bootstrapSystemAdministrator,
		boolean mustChangePassword,
		UUID sessionId) implements Serializable {

}
