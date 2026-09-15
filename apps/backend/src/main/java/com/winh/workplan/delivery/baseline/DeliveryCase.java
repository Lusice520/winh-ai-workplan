package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name="delivery_case")
class DeliveryCase extends BusinessRecord {
    @Column(nullable=false,unique=true) UUID projectId;
    @Column(nullable=false,length=24) String status="PREPARING";
    @Column(nullable=false) UUID managerId;
    @Column(nullable=false) UUID preparedBy;
    @Column(nullable=false,columnDefinition="text") String headerJson;
    @Column(nullable=false) UUID handoverPackageId;
    @Column(nullable=false,columnDefinition="text") String handoverJson;
    @Column UUID templateEditionId;
    @Column(columnDefinition="text") String templateJson;
    @Column UUID policyEditionId;
    @Column(columnDefinition="text") String policyJson;
    @Column UUID currentRoundId;
    @Column(nullable=false) int roundNumber;
    @Column(nullable=false) int baselineVersion;
    protected DeliveryCase() {}
}
