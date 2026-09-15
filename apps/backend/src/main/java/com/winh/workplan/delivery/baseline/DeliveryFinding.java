package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="delivery_finding")
class DeliveryFinding extends BusinessRecord {
    @Column(nullable=false) UUID caseId;
    @Column(nullable=false,columnDefinition="text") String contentJson;
    @Column(nullable=false,length=24) String status="OPEN";
    @Column(nullable=false) boolean blocking;
    @Column(nullable=false) UUID preparedBy;
    @Column(length=4000) String evidence;
    @Column UUID evidenceBy;
    @Column Instant evidenceAt;
    @Column(length=4000) String verification;
    @Column UUID verifiedBy;
    @Column Instant verifiedAt;
    protected DeliveryFinding() {}
}
