package com.winh.workplan.handover;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface EarlyStartApplicationRepository extends JpaRepository<EarlyStartApplication,UUID> {
java.util.List<EarlyStartApplication> findAllByProjectIdOrderByCreatedAtDesc(UUID id);
}
