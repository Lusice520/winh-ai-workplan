package com.winh.workplan.crm;
import java.util.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
interface OpportunityRepository extends JpaRepository<Opportunity, UUID> {
    List<Opportunity> findAllByCustomerIdOrderByUpdatedAtDesc(UUID customerId);
    Optional<Opportunity> findByCustomerIdAndEventKey(UUID customerId, String eventKey);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select o from Opportunity o where o.id = :id")
    Optional<Opportunity> lockById(@Param("id") UUID id);
}
