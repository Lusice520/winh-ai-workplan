package com.winh.workplan.crm;
import java.util.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
interface CustomerRepository extends JpaRepository<Customer, UUID> {
    Optional<Customer> findByActiveIdentifier(String identifier);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from Customer c where c.id = :id")
    Optional<Customer> lockById(@Param("id") UUID id);
}
