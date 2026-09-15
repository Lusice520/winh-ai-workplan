package com.winh.workplan.presales;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface PresalesInvestmentRepository extends JpaRepository<PresalesInvestment, UUID> {
    List<PresalesInvestment> findAllByProjectIdOrderByCreatedAtDesc(UUID projectId);
}
