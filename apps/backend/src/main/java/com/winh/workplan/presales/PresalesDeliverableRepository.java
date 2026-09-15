package com.winh.workplan.presales;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface PresalesDeliverableRepository extends JpaRepository<PresalesDeliverable, UUID> {
    List<PresalesDeliverable> findAllByProjectIdOrderByCreatedAtDesc(UUID projectId);
    List<PresalesDeliverable> findAllByActionIdOrderByVersionNumberDesc(UUID actionId);
}
