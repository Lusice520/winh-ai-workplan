package com.winh.workplan.presales;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface PresalesInitiationRepository extends JpaRepository<PresalesInitiation, UUID> {
    List<PresalesInitiation> findAllByProjectIdOrderByCreatedAtDesc(UUID projectId);
}
