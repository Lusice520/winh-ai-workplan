package com.winh.workplan.files;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
interface DocumentVersionRepository extends JpaRepository<DocumentVersion, UUID> {
    List<DocumentVersion> findAllByDocumentIdOrderByVersionNumberDesc(UUID documentId);
}
