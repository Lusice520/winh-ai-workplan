package com.winh.workplan.work;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryTaskEventRepository extends JpaRepository<DeliveryTaskEvent,UUID> {
    List<DeliveryTaskEvent> findAllByProjectIdAndTaskIdOrderByCreatedAtDesc(UUID projectId,UUID taskId);
    List<DeliveryTaskEvent> findTop20ByProjectIdAndTaskIdInOrderByCreatedAtDesc(UUID projectId,List<UUID> taskIds);
}
