package com.winh.workplan.execution;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name="execution_item_profile")
class ExecutionItemProfile extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false) UUID itemId;
    @Column(nullable=false) boolean requiresReceipt;
    @Column(nullable=false) boolean requiresInstallation;
    @Column(length=160) String brand;
    @Column(length=160) String model;
    @Column(length=240) String supplier;
    @Column(nullable=false,columnDefinition="text") String scopeJson;
    @Column(nullable=false) long objectVersion;
    protected ExecutionItemProfile(){}
}
