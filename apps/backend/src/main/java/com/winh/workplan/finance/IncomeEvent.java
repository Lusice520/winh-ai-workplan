package com.winh.workplan.finance;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name="project_income_event")
class IncomeEvent extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false) UUID objectId;
    @Column(nullable=false,length=16) String objectType;
    @Column(nullable=false,length=32) String action;
    @Column(nullable=false,length=4000) String reason;
    @Column(nullable=false) UUID actorId;
    @Column(nullable=false,columnDefinition="text") String beforeJson;
    @Column(nullable=false,columnDefinition="text") String afterJson;
    protected IncomeEvent(){}
}
