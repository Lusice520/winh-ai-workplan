package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
import java.time.Instant;
@Entity @Table(name="delivery_change")
class DeliveryChange extends BusinessRecord {
    @Column(nullable=false) UUID caseId;
    @Column(nullable=false) UUID objectId;
    @Column(nullable=false) long expectedObjectVersion;
    @Column(nullable=false,columnDefinition="text") String contentJson;
    @Column(nullable=false) boolean archiveRequested;
    @Column(nullable=false,length=24) String status="PENDING";
    @Column(nullable=false) UUID submittedBy;
    @Column(nullable=false,length=2000) String reason;
    @Column(nullable=false,length=4000) String impact;
    @Column(nullable=false,length=4000) String basis;
    @Column UUID decidedBy;
    @Column Instant decidedAt;
    @Column(length=4000) String decision;
    protected DeliveryChange() {}
}
