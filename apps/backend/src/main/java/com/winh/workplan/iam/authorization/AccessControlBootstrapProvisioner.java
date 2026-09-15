package com.winh.workplan.iam.authorization;

import java.util.UUID;

public interface AccessControlBootstrapProvisioner {

	void ensureBootstrapAdministratorAssignment(UUID accountId);
}
