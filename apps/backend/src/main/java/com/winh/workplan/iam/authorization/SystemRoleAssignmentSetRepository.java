package com.winh.workplan.iam.authorization;

import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SystemRoleAssignmentSetRepository extends JpaRepository<SystemRoleAssignmentSet, UUID> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select assignmentSet from SystemRoleAssignmentSet assignmentSet where assignmentSet.accountId = :accountId")
	Optional<SystemRoleAssignmentSet> findLockedByAccountId(@Param("accountId") UUID accountId);
}
