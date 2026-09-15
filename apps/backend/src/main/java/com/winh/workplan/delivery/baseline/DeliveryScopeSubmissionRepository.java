package com.winh.workplan.delivery.baseline;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface DeliveryScopeSubmissionRepository extends JpaRepository<DeliveryScopeSubmission,UUID> {
    List<DeliveryScopeSubmission> findAllByChangeIdOrderByNumberDesc(UUID changeId);
}
