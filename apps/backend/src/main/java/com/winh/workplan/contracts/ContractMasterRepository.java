package com.winh.workplan.contracts;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
interface ContractMasterRepository extends JpaRepository<ContractMaster, UUID> {
    boolean existsByNumberKey(String numberKey);
    boolean existsByProjectIdAndPrimaryContractTrue(UUID projectId);
    List<ContractMaster> findAllByProjectIdOrderByCreatedAtDesc(UUID projectId);
}
