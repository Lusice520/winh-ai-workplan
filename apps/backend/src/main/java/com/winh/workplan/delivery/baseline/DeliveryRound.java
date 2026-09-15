package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="delivery_round", uniqueConstraints=@UniqueConstraint(columnNames={"case_id","round_number"}))
class DeliveryRound extends BusinessRecord {
    @Column(nullable=false) UUID caseId;
    @Column(nullable=false) int roundNumber;
    @Column(nullable=false,length=24) String status="SUBMITTED";
    @Column(nullable=false,columnDefinition="text") String snapshotJson;
    @Column(nullable=false,length=64) String snapshotHash;
    @Column(nullable=false) UUID submittedBy;
    @Column(nullable=false,length=4000) String submissionNote;
    @Column UUID decidedBy;
    @Column Instant decidedAt;
    @Column(length=4000) String decisionNote;
    protected DeliveryRound() {}
}
