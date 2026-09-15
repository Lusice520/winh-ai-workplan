package com.winh.workplan.iam.authorization;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemRoleAssignmentRepository extends JpaRepository<SystemRoleAssignment, UUID> {

	List<SystemRoleAssignment> findAllByAccountIdAndStatus(UUID accountId, SystemRoleAssignmentStatus status);

	List<SystemRoleAssignment> findAllByAccountIdInAndStatus(Collection<UUID> accountIds, SystemRoleAssignmentStatus status);

	List<SystemRoleAssignment> findAllByAccountIdOrderByAssignedAtDesc(UUID accountId);

	java.util.Optional<SystemRoleAssignment> findByAccountIdAndRoleId(UUID accountId, UUID roleId);

	boolean existsByAccountIdAndRoleId(UUID accountId, UUID roleId);
}
