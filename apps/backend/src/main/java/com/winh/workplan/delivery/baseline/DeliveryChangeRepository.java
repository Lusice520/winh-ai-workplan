package com.winh.workplan.delivery.baseline;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryChangeRepository extends JpaRepository<DeliveryChange,UUID> {
    List<DeliveryChange> findAllByCaseIdOrderByCreatedAtDesc(UUID caseId);
    boolean existsByCaseIdAndObjectIdAndStatus(UUID caseId, UUID objectId, String status);
}
