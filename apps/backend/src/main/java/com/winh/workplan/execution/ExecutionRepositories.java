package com.winh.workplan.execution;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface ExecutionStageRepository extends JpaRepository<ExecutionStage,UUID>{
    Optional<ExecutionStage> findByProjectIdAndStageId(UUID projectId,UUID stageId);
    List<ExecutionStage> findAllByProjectId(UUID projectId);
}
interface ExecutionProfileRepository extends JpaRepository<ExecutionItemProfile,UUID>{
    Optional<ExecutionItemProfile> findByProjectIdAndItemId(UUID projectId,UUID itemId);
    List<ExecutionItemProfile> findAllByProjectId(UUID projectId);
}
interface ExecutionItemEventRepository extends JpaRepository<ExecutionItemEvent,UUID>{
    List<ExecutionItemEvent> findAllByProjectIdOrderByCreatedAtDesc(UUID projectId);
    List<ExecutionItemEvent> findAllByProjectIdAndItemIdOrderByCreatedAtDesc(UUID projectId,UUID itemId);
    boolean existsByReversalOfId(UUID id);
}
interface ExecutionMilestoneRepository extends JpaRepository<ExecutionMilestone,UUID>{
    Optional<ExecutionMilestone> findByProjectIdAndMilestoneId(UUID projectId,UUID milestoneId);
    List<ExecutionMilestone> findAllByProjectId(UUID projectId);
}
interface ExecutionEventRepository extends JpaRepository<ExecutionEvent,UUID>{
    List<ExecutionEvent> findTop100ByProjectIdOrderByCreatedAtDesc(UUID projectId);
    List<ExecutionEvent> findAllByProjectIdAndObjectIdOrderByCreatedAtDesc(UUID projectId,UUID objectId);
}
