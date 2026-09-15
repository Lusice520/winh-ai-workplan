package com.winh.workplan.delivery.baseline;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryObjectRepository extends JpaRepository<DeliveryObject,UUID> {
    List<DeliveryObject> findAllByCaseIdOrderByCreatedAtAsc(UUID caseId);
}
