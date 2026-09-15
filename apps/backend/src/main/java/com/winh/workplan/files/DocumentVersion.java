package com.winh.workplan.files;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
import java.time.Instant;
@Entity @Table(name = "document_version")
class DocumentVersion extends BusinessRecord {
    @Column(nullable = false) UUID documentId;
    @Column(nullable = false) int versionNumber;
    @Column(nullable = false, length = 240) String filename;
    @Column(nullable = false, length = 200) String objectKey;
    @Column(nullable = false) long sizeBytes;
    @Column(nullable = false, length = 64) String sha256;
    @Column(nullable = false, length = 24) String status = "DRAFT";
    @Column(nullable = false, length = 2000) String changeNote;
    @Column(nullable = false) UUID uploadedBy;
    UUID reviewedBy;
    Instant reviewedAt;
    @Column(length = 2000) String reviewComment;
}
