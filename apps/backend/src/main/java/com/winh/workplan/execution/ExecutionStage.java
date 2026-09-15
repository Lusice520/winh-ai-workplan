package com.winh.workplan.execution;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
@Entity @Table(name="execution_stage")
class ExecutionStage extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false) UUID stageId;
    @Column(nullable=false,length=24) String status="NOT_STARTED";
    @Column(nullable=false) int progress;
    @Column LocalDate startedOn;
    @Column LocalDate completedOn;
    @Column(nullable=false,length=64) String scopeHash;
    @Column(nullable=false) long objectVersion;
    @Column(nullable=false) int baselineVersion;
    protected ExecutionStage(){}
}
