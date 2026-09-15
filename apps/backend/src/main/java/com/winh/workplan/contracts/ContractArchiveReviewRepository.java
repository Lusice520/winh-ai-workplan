package com.winh.workplan.contracts;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
interface ContractArchiveReviewRepository extends JpaRepository<ContractArchiveReview, UUID> {
    List<ContractArchiveReview> findAllByContractIdOrderByCreatedAtDesc(UUID contractId);
}
