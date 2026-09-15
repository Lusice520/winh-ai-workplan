package com.winh.workplan.delivery.baseline;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryScopeEventRepository extends JpaRepository<DeliveryScopeEvent,UUID> {
    List<DeliveryScopeEvent> findTop100ByChangeIdOrderByCreatedAtDesc(UUID changeId);
}
