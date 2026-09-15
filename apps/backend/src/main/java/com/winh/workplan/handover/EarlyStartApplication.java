package com.winh.workplan.handover;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
@Entity @Table(name="early_start_application")
class EarlyStartApplication extends BusinessRecord {
@Column(nullable=false) UUID projectId;
@Column(nullable=false,length=160) String title;
@Column(nullable=false,length=4000) String scope;
@Column(nullable=false,length=4000) String scopeItems;
@Column(nullable=false,precision=16,scale=2) BigDecimal requestedHours;
@Column(nullable=false,precision=16,scale=2) BigDecimal requestedCost;
@Column(precision=16,scale=2) BigDecimal approvedHours;
@Column(precision=16,scale=2) BigDecimal approvedCost;
@Column(nullable=false) LocalDate startsOn;
@Column(nullable=false) LocalDate endsOn;
@Column(nullable=false) UUID riskOwnerId;
@Column(nullable=false,length=4000) String stopConditions;
@Column(nullable=false,length=4000) String missingItems;
@Column(nullable=false,length=4000) String regularizationPlan;
@Column(nullable=false,length=24) String status="DRAFT";
@Column(nullable=false) UUID createdBy;
UUID submittedBy;
UUID approvedBy;
Instant approvedAt;
UUID regularizationPackageId;
@Column(length=2000) String finishReason;
}
