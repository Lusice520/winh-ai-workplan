package com.winh.workplan.contracts;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
interface ContractNodeRepository extends JpaRepository<ContractNode, UUID> {
    List<ContractNode> findAllByContractIdOrderByDueDateAscCreatedAtAsc(UUID contractId);
}
