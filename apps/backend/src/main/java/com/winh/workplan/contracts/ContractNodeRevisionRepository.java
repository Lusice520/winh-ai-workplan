package com.winh.workplan.contracts;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

interface ContractNodeRevisionRepository extends JpaRepository<ContractNodeRevision, UUID> {
    List<ContractNodeRevision> findAllByContractIdOrderByCreatedAtDesc(UUID contractId);
}
