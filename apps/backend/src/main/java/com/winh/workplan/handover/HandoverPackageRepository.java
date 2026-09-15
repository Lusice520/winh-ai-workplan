package com.winh.workplan.handover;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface HandoverPackageRepository extends JpaRepository<HandoverPackage,UUID> {
java.util.List<HandoverPackage> findAllByCaseIdOrderByCreatedAtDesc(UUID id);
}
