package com.winh.workplan.presales;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface PresalesActionRepository extends JpaRepository<PresalesAction, UUID> {
    List<PresalesAction> findAllByProjectIdOrderBySortOrderAsc(UUID projectId);
}
