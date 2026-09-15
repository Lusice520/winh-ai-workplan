package com.winh.workplan.execution;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.*;
import java.math.BigDecimal;
import java.util.UUID;
@Entity @Table(name="execution_item_event")
class ExecutionItemEvent extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false) UUID itemId;
    @Column(nullable=false,length=24) String kind;
    @Column(nullable=false,length=24) String status;
    @Column(nullable=false,precision=14,scale=2) BigDecimal quantity;
    @Column(nullable=false) LocalDate occurredOn;
    @Column(nullable=false,length=4000) String evidence;
    @Column(nullable=false,columnDefinition="text") String filesJson="[]";
    @Column(nullable=false) UUID submittedBy;
    @Column UUID verifierId;
    @Column UUID decidedBy;
    @Column Instant decidedAt;
    @Column(length=4000) String decision;
    @Column UUID reversalOfId;
    @Column(nullable=false,length=64) String scopeHash;
    @Column(nullable=false) long objectVersion;
    @Column(nullable=false) int baselineVersion;
    protected ExecutionItemEvent(){}
}
