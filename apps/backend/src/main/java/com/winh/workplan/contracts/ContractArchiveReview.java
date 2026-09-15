package com.winh.workplan.contracts;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
@Entity @Table(name="contract_archive_review")
class ContractArchiveReview extends BusinessRecord {
    @Column(nullable=false) UUID contractId;
    @Column(nullable=false,length=24) String status="SUBMITTED";
    @Column(nullable=false,length=30000) String snapshot;
    @Column(nullable=false,length=2000) String submissionNote;
    @Column(nullable=false) UUID submittedBy;
    UUID reviewedBy;
    Instant reviewedAt;
    @Column(length=2000) String reviewComment;
}
