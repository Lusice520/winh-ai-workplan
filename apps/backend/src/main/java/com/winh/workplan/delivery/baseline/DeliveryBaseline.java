package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name="delivery_baseline",uniqueConstraints=@UniqueConstraint(columnNames={"case_id","baseline_version"}))
class DeliveryBaseline extends BusinessRecord {
    @Column(nullable=false) UUID caseId;
    @Column(nullable=false) int baselineVersion;
    @Column UUID roundId;
    @Column(nullable=false,columnDefinition="text") String snapshotJson;
    @Column(nullable=false,length=64) String snapshotHash;
    @Column(nullable=false) UUID approvedBy;
    @Column(nullable=false,length=4000) String reason;
    protected DeliveryBaseline() {}
}
