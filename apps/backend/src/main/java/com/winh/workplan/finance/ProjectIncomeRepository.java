package com.winh.workplan.finance;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface ProjectIncomeRepository extends JpaRepository<ProjectIncome,UUID> {
    List<ProjectIncome> findAllByProjectIdOrderByOccurredOnDescCreatedAtDesc(UUID projectId);
    boolean existsByOriginalIncomeIdAndKindAndStatus(UUID originalIncomeId,String kind,String status);
}
