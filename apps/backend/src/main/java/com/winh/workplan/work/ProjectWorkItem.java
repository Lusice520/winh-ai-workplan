package com.winh.workplan.work;
import java.util.UUID;
import java.time.*;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
@Entity @Table(name="project_work_item")
class ProjectWorkItem extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column UUID sourceRequirementId;
    @Column(nullable=false,length=24) String creationSource="REQUIREMENT";
    @Column(nullable=false,length=24) String deliveryState="NOT_REQUIRED";
    @Column(nullable=false) int deliveryBaselineVersion;
    @Column(nullable=false,length=24) String kind;
    @Column(nullable=false,length=160) String title;
    @Column(nullable=false,length=8000) String description;
    @Column(nullable=false) UUID ownerAccountId;
    @Column(nullable=false) UUID verifierAccountId;
    @Column(nullable=false) UUID createdBy;
    @Column(nullable=false,length=32) String status="OPEN";
    @Column LocalDate dueDate;
    @Column(length=4000) String evidence;
    @Column UUID completedBy;
    @Column UUID approvedBy;
    @Column Instant approvedAt;
    @Column UUID verifiedBy;
    @Column Instant verifiedAt;
    protected ProjectWorkItem(){}
}
