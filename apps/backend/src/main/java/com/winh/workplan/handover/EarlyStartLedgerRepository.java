package com.winh.workplan.handover;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface EarlyStartLedgerRepository extends JpaRepository<EarlyStartLedger,UUID> {
java.util.List<EarlyStartLedger> findAllByApplicationIdOrderByCreatedAtDesc(UUID id);
}
