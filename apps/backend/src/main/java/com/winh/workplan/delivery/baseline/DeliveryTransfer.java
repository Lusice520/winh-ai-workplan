package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="delivery_responsibility_transfer")
class DeliveryTransfer extends BusinessRecord {
    @Column(nullable=false) UUID caseId;
    @Column(nullable=false) UUID fromId;
    @Column(nullable=false) UUID toId;
    @Column(nullable=false,columnDefinition="text") String mappingJson;
    @Column(nullable=false,length=64) String mappingHash;
    @Column(nullable=false,columnDefinition="text") String permissionsJson;
    @Column(nullable=false,columnDefinition="text") String signaturesJson="{\"items\":[]}";
    @Column(nullable=false,length=24) String status="PENDING";
    @Column(nullable=false,length=2000) String basis;
    @Column(nullable=false) UUID submittedBy;
    @Column UUID acceptedBy;
    @Column Instant acceptedAt;
    @Column(length=4000) String acceptanceNote;
    @Column UUID decidedBy;
    @Column Instant effectiveAt;
    @Column(length=4000) String decisionNote;
    protected DeliveryTransfer() {}
}
