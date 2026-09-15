package com.winh.workplan.delivery.baseline;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name="delivery_scope_event")
class DeliveryScopeEvent extends BusinessRecord {
    @Column(nullable=false) UUID changeId;
    @Column(nullable=false,length=32) String action;
    @Column(nullable=false) UUID actorId;
    @Column(nullable=false,length=4000) String note;
    protected DeliveryScopeEvent() {}
}
