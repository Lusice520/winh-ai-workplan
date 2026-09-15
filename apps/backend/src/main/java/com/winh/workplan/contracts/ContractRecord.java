package com.winh.workplan.contracts;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
@Entity @Table(name="contract_record")
class ContractRecord extends BusinessRecord {
    @Column(nullable=false) UUID contractId;
    @Column(nullable=false,length=24) String kind;
    @Column(nullable=false,length=160) String title;
    @Column(nullable=false,length=4000) String description;
    @Column(nullable=false) LocalDate signedOn;
    @Column(nullable=false) UUID fileVersionId;
    @Column(precision=16,scale=2) BigDecimal amountBefore;
    @Column(precision=16,scale=2) BigDecimal amountAfter;
    @Column(nullable=false) UUID createdBy;
}
