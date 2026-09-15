package com.winh.workplan.delivery.baseline;
import java.util.*;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryResourceRepository extends JpaRepository<DeliveryResource,UUID> {
    List<DeliveryResource> findAllByCaseIdOrderByCreatedAtAsc(UUID caseId);
    List<DeliveryResource> findAllByPersonIdAndStartsOnLessThanEqualAndEndsOnGreaterThanEqual(UUID personId, LocalDate endsOn, LocalDate startsOn);
}
