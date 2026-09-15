package com.winh.workplan.contracts;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
@Entity @Table(name="contract_node")
class ContractNode extends BusinessRecord {
    @Column(nullable=false) UUID contractId;
    UUID recordId;
    @Column(nullable=false,length=160) String title;
    @Column(nullable=false,length=24) String kind;
    @Column(nullable=false) LocalDate dueDate;
    @Column(precision=16,scale=2) BigDecimal amount;
    @Column(nullable=false,length=2000) String conditions;
    @Column(nullable=false,length=24) String status="PLANNED";
    LocalDate completedOn;
    @Column(length=4000) String evidence;
    UUID completedBy;
}
