package com.winh.workplan.requirements;
import com.winh.workplan.business.BusinessRecord;
import java.util.UUID;
import java.time.*;
import jakarta.persistence.*;
@Entity @Table(name="project_requirement")
class ProjectRequirement extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false,unique=true,length=40) String code;
    @Column(nullable=false,length=160) String title;
    @Column(nullable=false,length=8000) String originalText;
    @Column(nullable=false,length=24) String source;
    @Column(nullable=false,length=160) String requester;
    @Column(nullable=false) UUID createdBy;
    @Column(nullable=false) UUID ownerAccountId;
    @Column(nullable=false) UUID verifierAccountId;
    @Column(nullable=false,length=4000) String handlerIds;
    @Column(nullable=false,length=24) String priority;
    @Column(nullable=false,length=32) String status;
    @Column() LocalDate expectedOn;
    @Column(nullable=false) boolean importantCustomer;
    @Column(length=24) String disposition;
    @Column(length=4000) String completionEvidence;
    @Column() UUID completedBy;
    @Column(length=4000) String verificationComment;
    @Column(length=4000) String customerEvidence;
    @Column() UUID verifiedBy;
    @Column() Instant verifiedAt;
    protected ProjectRequirement(){}
}
