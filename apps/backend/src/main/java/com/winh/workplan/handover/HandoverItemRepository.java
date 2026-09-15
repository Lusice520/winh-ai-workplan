package com.winh.workplan.handover;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface HandoverItemRepository extends JpaRepository<HandoverItem,UUID> {
java.util.List<HandoverItem> findAllByCaseIdOrderBySortOrderAsc(UUID id);
}
