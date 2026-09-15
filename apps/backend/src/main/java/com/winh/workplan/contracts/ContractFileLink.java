package com.winh.workplan.contracts;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
@Entity @Table(name="contract_file_link")
class ContractFileLink extends BusinessRecord {
    @Column(nullable=false) UUID contractId;
    @Column(nullable=false) UUID fileVersionId;
    @Column(nullable=false,length=24) String kind;
    @Column(nullable=false) boolean active=true;
    @Column(nullable=false) UUID linkedBy;
}
