package com.winh.workplan.finance;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
@Entity @Table(name="project_income")
class ProjectIncome extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false,length=16) String kind;
    @Column(nullable=false,length=16) String status="DRAFT";
    @Column(nullable=false,length=160) String title;
    @Column(nullable=false,precision=14,scale=2) BigDecimal amount;
    @Column(nullable=false,length=3) String currency;
    @Column(nullable=false) LocalDate occurredOn;
    @Column(nullable=false,length=4000) String sourceNote;
    @Column(nullable=false,columnDefinition="text") String sourceJson="null";
    @Column(nullable=false,columnDefinition="text") String forecastJson="null";
    @Column(length=4000) String unplannedReason;
    @Column UUID originalIncomeId;
    @Column(nullable=false) UUID createdBy;
    @Column(nullable=false) UUID ownerId;
    @Column(nullable=false) UUID confirmerId;
    @Column UUID submittedBy;
    @Column Instant submittedAt;
    @Column UUID confirmedBy;
    @Column Instant confirmedAt;
    @Column(nullable=false,columnDefinition="text") String filesJson="[]";
    protected ProjectIncome(){}
}
