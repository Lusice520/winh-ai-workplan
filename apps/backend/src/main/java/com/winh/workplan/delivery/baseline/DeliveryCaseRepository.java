package com.winh.workplan.delivery.baseline;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryCaseRepository extends JpaRepository<DeliveryCase,UUID> {
    Optional<DeliveryCase> findByProjectId(UUID projectId);
}
