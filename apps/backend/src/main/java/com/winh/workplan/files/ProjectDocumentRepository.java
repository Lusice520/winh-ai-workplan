package com.winh.workplan.files;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
interface ProjectDocumentRepository extends JpaRepository<ProjectDocument, UUID> {
    List<ProjectDocument> findAllByProjectIdOrderByUpdatedAtDesc(UUID projectId);
}
