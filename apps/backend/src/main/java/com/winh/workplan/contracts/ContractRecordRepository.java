package com.winh.workplan.contracts;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
interface ContractRecordRepository extends JpaRepository<ContractRecord, UUID> {
    List<ContractRecord> findAllByContractIdOrderByCreatedAtDesc(UUID contractId);
}
