package com.winh.workplan.finance;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface IncomeEventRepository extends JpaRepository<IncomeEvent,UUID> {
    List<IncomeEvent> findAllByProjectIdAndObjectIdOrderByCreatedAtAsc(UUID projectId,UUID objectId);
}
