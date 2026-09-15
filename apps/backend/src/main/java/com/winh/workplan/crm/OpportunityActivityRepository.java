package com.winh.workplan.crm;
import java.util.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
interface OpportunityActivityRepository extends JpaRepository<OpportunityActivity, UUID> {
    List<OpportunityActivity> findAllByOpportunityIdOrderByCreatedAtDesc(UUID opportunityId);
}
