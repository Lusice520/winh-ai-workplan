package com.winh.workplan.handover;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface EarlyClosureAllowanceRepository extends JpaRepository<EarlyClosureAllowance,UUID> {
java.util.List<EarlyClosureAllowance> findAllByApplicationIdOrderByCreatedAtDesc(UUID id);
}
