package com.winh.workplan.iam.identity;

import java.util.UUID;

public interface SessionRevoker {

	void revokeSessionsForAccount(UUID accountId, String reason);
}
