package com.winh.workplan.delivery.baseline;

import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;

@Entity @Table(name="delivery_scope_change")
class DeliveryScopeChange extends BusinessRecord {
    @Column(nullable=false) UUID caseId;
    @Column(nullable=false,length=24) String status="DRAFT";
    @Column(nullable=false) int baseBaselineVersion;
    @Column(nullable=false,length=64) String baseHash;
    @Column(nullable=false,columnDefinition="text") String baseSnapshotJson;
    @Column(nullable=false,columnDefinition="text") String draftJson="{\"objects\":[],\"resources\":[]}";
    @Column(columnDefinition="text") String policyJson;
    @Column(nullable=false,length=2000) String reason;
    @Column(nullable=false,length=4000) String impact;
    @Column(nullable=false,length=4000) String basis;
    @Column(nullable=false) UUID createdBy;
    @Column(nullable=false) UUID preparedBy;
    @Column UUID currentSubmissionId;
    protected DeliveryScopeChange() {}
}
