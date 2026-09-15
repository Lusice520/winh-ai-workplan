package com.winh.workplan.handover;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
@Entity @Table(name="handover_package")
class HandoverPackage extends BusinessRecord {
@Column(nullable=false) UUID caseId;
@Column(nullable=false,unique=true) UUID reviewId;
@Column(nullable=false,length=40) String number;
@Column(nullable=false,columnDefinition="text") String snapshot;
@Column(nullable=false,length=64) String snapshotHash;
@Column(nullable=false) UUID approvedBy;
@Column(nullable=false,length=2000) String reviewComment;
}
