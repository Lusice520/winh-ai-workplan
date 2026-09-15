package com.winh.workplan.handover;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface HandoverCaseRepository extends JpaRepository<HandoverCase,UUID> {
java.util.Optional<HandoverCase> findByProjectId(UUID projectId);
}
