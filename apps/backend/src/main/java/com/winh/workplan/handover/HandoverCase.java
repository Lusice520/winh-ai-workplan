package com.winh.workplan.handover;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
@Entity @Table(name="handover_case")
class HandoverCase extends BusinessRecord {
@Column(nullable=false,unique=true) UUID projectId;
@Column(nullable=false,length=40) String projectType;
@Column(nullable=false,length=40) String templateVersion="HG-2026-09-v1";
@Column(nullable=false,length=24) String status="DRAFT";
@Column(nullable=false) UUID receiverId;
@Column(nullable=false) LocalDate dueDate;
@Column(length=24) String basisKind;
UUID basisReferenceId;
@Column(length=2000) String basisNote;
UUID currentPackageId;
}
