package com.winh.workplan.delivery.baseline;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryScopeRepository extends JpaRepository<DeliveryScopeChange,UUID> {
    List<DeliveryScopeChange> findAllByCaseIdOrderByCreatedAtDesc(UUID caseId);
    boolean existsByCaseIdAndStatusIn(UUID caseId,Collection<String> statuses);
}
