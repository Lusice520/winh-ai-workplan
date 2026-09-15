package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
/** Append-only facts; summaries are public, content still requires its domain permission. */
@Entity @Table(name="delivery_revision")
class DeliveryRevision extends BusinessRecord {
    @Column(nullable=false) UUID caseId;
    @Column(nullable=false) UUID objectId;
    @Column(nullable=false,length=24) String kind;
    @Column(nullable=false) long objectVersion;
    @Column(columnDefinition="text") String beforeJson;
    @Column(nullable=false,columnDefinition="text") String afterJson;
    @Column(nullable=false) UUID actorId;
    @Column(nullable=false,length=2000) String reason;
    @Column(length=4000) String impact;
    @Column(length=4000) String basis;
    protected DeliveryRevision() {}
}
