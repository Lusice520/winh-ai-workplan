package com.winh.workplan.business;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface BusinessEventRepository extends JpaRepository<BusinessEvent, UUID> {
    List<BusinessEvent> findAllByObjectIdOrderByCreatedAtDesc(UUID objectId);
}
