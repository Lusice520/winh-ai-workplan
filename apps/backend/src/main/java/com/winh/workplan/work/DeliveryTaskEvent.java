package com.winh.workplan.work;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name="delivery_task_event")
class DeliveryTaskEvent extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false) UUID taskId;
    @Column(nullable=false,length=32) String action;
    @Column(nullable=false,length=4000) String note;
    @Column(nullable=false) UUID actorId;
    @Column(nullable=false,columnDefinition="text") String beforeJson;
    @Column(nullable=false,columnDefinition="text") String afterJson;
    protected DeliveryTaskEvent(){}
}
