package com.winh.workplan.execution;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;
@Entity @Table(name="execution_milestone")
class ExecutionMilestone extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false) UUID milestoneId;
    @Column(nullable=false,length=24) String status="OPEN";
    @Column LocalDate occurredOn;
    @Column(length=4000) String evidence;
    @Column(nullable=false,columnDefinition="text") String filesJson="[]";
    @Column UUID submittedBy;
    @Column UUID verifierId;
    @Column UUID decidedBy;
    @Column Instant decidedAt;
    @Column(length=4000) String decision;
    @Column(nullable=false,length=64) String scopeHash;
    @Column(nullable=false) long objectVersion;
    @Column(nullable=false) int baselineVersion;
    protected ExecutionMilestone(){}
}
