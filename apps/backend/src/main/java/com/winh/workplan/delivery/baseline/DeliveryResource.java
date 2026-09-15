package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.*;
import java.math.BigDecimal;
import java.util.UUID;
@Entity @Table(name="delivery_resource")
class DeliveryResource extends BusinessRecord {
    @Column(nullable=false) UUID caseId;
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false) UUID workPackageId;
    @Column(nullable=false) UUID personId;
    @Column(nullable=false) UUID committerId;
    @Column(nullable=false) LocalDate startsOn;
    @Column(nullable=false) LocalDate endsOn;
    @Column(nullable=false,precision=5,scale=2) BigDecimal dailyHours;
    @Column(nullable=false,columnDefinition="text") String requestJson;
    @Column(nullable=false,length=24) String status="REQUESTED";
    @Column(columnDefinition="text") String commitmentJson;
    @Column UUID committedBy;
    @Column Instant committedAt;
    @Column(length=64) String overlapHash;
    @Column(nullable=false) UUID preparedBy;
    protected DeliveryResource() {}
}
