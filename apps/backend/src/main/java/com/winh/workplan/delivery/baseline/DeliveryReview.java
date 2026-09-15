package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="delivery_review",uniqueConstraints=@UniqueConstraint(columnNames={"round_id","reviewer_id"}))
class DeliveryReview extends BusinessRecord {
    @Column(nullable=false) UUID roundId;
    @Column(nullable=false) UUID reviewerId;
    @Column(nullable=false,length=24) String scope;
    @Column(nullable=false,length=24) String status="PENDING";
    @Column(length=4000) String comment;
    @Column Instant reviewedAt;
    protected DeliveryReview() {}
}
