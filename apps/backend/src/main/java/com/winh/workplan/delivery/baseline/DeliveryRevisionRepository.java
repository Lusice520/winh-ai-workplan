package com.winh.workplan.delivery.baseline;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryRevisionRepository extends JpaRepository<DeliveryRevision,UUID> {
    List<DeliveryRevision> findAllByCaseIdOrderByCreatedAtDesc(UUID caseId);
}
