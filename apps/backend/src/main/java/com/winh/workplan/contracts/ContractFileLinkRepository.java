package com.winh.workplan.contracts;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
interface ContractFileLinkRepository extends JpaRepository<ContractFileLink, UUID> {
    List<ContractFileLink> findAllByContractIdOrderByCreatedAtDesc(UUID contractId);
}
