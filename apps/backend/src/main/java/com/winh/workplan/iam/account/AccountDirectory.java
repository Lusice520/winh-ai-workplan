package com.winh.workplan.iam.account;

import java.util.Optional;
import java.util.UUID;

public interface AccountDirectory {

	Optional<AccountAuthorizationSnapshot> findAuthorizationSnapshot(UUID accountId);

	java.util.List<AccountAuthorizationSnapshot> listActive();
    /** Serializes commitments for one person across projects in the caller's transaction. */
    void lockForResourceCommit(UUID accountId);
}
