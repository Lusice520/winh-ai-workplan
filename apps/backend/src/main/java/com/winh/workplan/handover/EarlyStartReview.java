package com.winh.workplan.handover;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
@Entity @Table(name="early_start_review")
class EarlyStartReview extends BusinessRecord {
@Column(nullable=false) UUID applicationId;
@Column(nullable=false,length=24) String status="SUBMITTED";
@Column(nullable=false,columnDefinition="text") String snapshot;
@Column(nullable=false,length=64) String snapshotHash;
@Column(nullable=false) UUID submittedBy;
UUID reviewedBy;
Instant reviewedAt;
@Column(length=2000) String reviewComment;
}
