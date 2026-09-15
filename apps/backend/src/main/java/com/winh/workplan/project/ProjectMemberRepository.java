package com.winh.workplan.project;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface ProjectMemberRepository extends JpaRepository<ProjectMember, UUID> {
    List<ProjectMember> findAllByProjectIdOrderByCreatedAtAsc(UUID projectId);
    Optional<ProjectMember> findByProjectIdAndAccountId(UUID projectId, UUID accountId);
    boolean existsByProjectIdAndAccountIdAndActiveTrue(UUID projectId, UUID accountId);
}
