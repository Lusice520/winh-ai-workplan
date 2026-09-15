package com.winh.workplan.iam.authorization;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface ProjectRoleAssignmentRepository extends JpaRepository<ProjectRoleAssignment, UUID> {
    List<ProjectRoleAssignment> findAllByAccountIdAndProjectIdAndActiveTrue(UUID accountId, UUID projectId);
    List<ProjectRoleAssignment> findAllByAccountIdAndProjectId(UUID accountId, UUID projectId);
}
