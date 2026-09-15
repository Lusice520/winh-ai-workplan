package com.winh.workplan.execution;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
@Entity @Table(name="execution_event")
class ExecutionEvent extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false) UUID objectId;
    @Column(nullable=false,length=24) String kind;
    @Column(nullable=false,length=40) String action;
    @Column(nullable=false,length=4000) String note;
    @Column(nullable=false) UUID actorId;
    @Column(nullable=false) LocalDate occurredOn;
    @Column(nullable=false,columnDefinition="text") String beforeJson;
    @Column(nullable=false,columnDefinition="text") String afterJson;
    @Column(nullable=false) long objectVersion;
    @Column(nullable=false) int baselineVersion;
    protected ExecutionEvent(){}
}
