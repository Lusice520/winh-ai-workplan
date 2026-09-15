package com.winh.workplan.delivery.baseline;

import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Each submission retains its own frozen content even after return and resubmission. */
@Entity @Table(name="delivery_scope_submission")
class DeliveryScopeSubmission extends BusinessRecord {
    @Column(nullable=false) UUID changeId;
    @Column(nullable=false) int number;
    @Column(nullable=false,length=24) String status="SUBMITTED";
    @Column(nullable=false,columnDefinition="text") String frozenJson;
    @Column(nullable=false,length=64) String snapshotHash;
    @Column(nullable=false) UUID submittedBy;
    @Column UUID decidedBy;
    @Column Instant decidedAt;
    @Column(length=4000) String decisionNote;
    @Column Integer baselineVersion;
    protected DeliveryScopeSubmission() {}
}
