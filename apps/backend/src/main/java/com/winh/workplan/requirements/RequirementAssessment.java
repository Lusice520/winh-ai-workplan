package com.winh.workplan.requirements;
import com.winh.workplan.business.BusinessRecord;
import java.util.UUID;
import java.time.*;
import jakarta.persistence.*;
@Entity @Table(name="requirement_assessment")
class RequirementAssessment extends BusinessRecord {
    @Column(nullable=false) UUID requirementId;
    @Column(nullable=false,length=8000) String clarification;
    @Column(nullable=false,length=80) String category;
    @Column(nullable=false,length=2000) String scopeImpact;
    @Column(nullable=false,length=2000) String technicalImpact;
    @Column(nullable=false,length=2000) String scheduleImpact;
    @Column(nullable=false,length=2000) String costImpact;
    @Column(nullable=false,length=2000) String contractImpact;
    @Column(nullable=false,length=2000) String acceptanceImpact;
    @Column(nullable=false,length=2000) String safetyImpact;
    @Column(nullable=false) boolean baselineImpact;
    @Column(nullable=false) UUID createdBy;
    protected RequirementAssessment(){}
}
