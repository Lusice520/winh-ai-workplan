package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name="delivery_object")
class DeliveryObject extends BusinessRecord {
    @Column(nullable=false) UUID caseId;
    @Column(nullable=false,length=24) String kind;
    @Column(nullable=false,columnDefinition="text") String contentJson;
    @Column(nullable=false) UUID preparedBy;
    @Column(nullable=false) boolean archived;
    @Column(nullable=false) int baselineVersion;
    protected DeliveryObject() {}
}
