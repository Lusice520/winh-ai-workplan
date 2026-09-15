package com.winh.workplan.crm;
import java.util.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
interface ContactRepository extends JpaRepository<Contact, UUID> {
    List<Contact> findAllByCustomerIdOrderByCreatedAtAsc(UUID customerId);
}
