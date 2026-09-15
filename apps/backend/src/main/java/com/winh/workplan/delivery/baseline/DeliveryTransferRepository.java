package com.winh.workplan.delivery.baseline;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryTransferRepository extends JpaRepository<DeliveryTransfer,UUID> {
    List<DeliveryTransfer> findAllByCaseIdOrderByCreatedAtDesc(UUID caseId);
}
