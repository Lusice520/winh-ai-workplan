package com.winh.workplan.iam.authorization;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TemporaryGrantRepository extends JpaRepository<TemporaryGrant, UUID> {

	List<TemporaryGrant> findAllByRecipientAccountIdAndStatusAndStartsAtLessThanEqualAndEndsAtAfter(
			UUID recipientAccountId,
			TemporaryGrantStatus status,
			Instant startsAt,
			Instant endsAt);

	List<TemporaryGrant> findAllByStatusAndEndsAtLessThanEqual(
			TemporaryGrantStatus status,
			Instant endsAt);

	long countByPermissionItemId(UUID permissionItemId);
}
