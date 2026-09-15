package com.winh.workplan.delivery.baseline;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryBaselineRepository extends JpaRepository<DeliveryBaseline,UUID> {
    List<DeliveryBaseline> findAllByCaseIdOrderByBaselineVersionDesc(UUID caseId);
}
