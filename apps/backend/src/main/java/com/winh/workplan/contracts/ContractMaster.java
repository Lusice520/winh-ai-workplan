package com.winh.workplan.contracts;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.UUID;
@Entity @Table(name="contract_master")
class ContractMaster extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false,length=80) String number;
    @Column(nullable=false,length=80) String numberKey;
    @Column(nullable=false,length=160) String title;
    @Column(name="party_a",nullable=false,length=240) String partyA;
    @Column(name="party_b",nullable=false,length=240) String partyB;
    @Column(nullable=false,precision=16,scale=2) BigDecimal amount;
    @Column(nullable=false) LocalDate signedOn;
    @Column(nullable=false) LocalDate effectiveOn;
    @Column(nullable=false,length=4000) String scope;
    @Column(nullable=false,length=24) String archiveStatus="DRAFT";
    @Column(nullable=false) boolean primaryContract;
    @Column(nullable=false) boolean everArchived;
    @Column(nullable=false) boolean terminated;
    @Column(nullable=false) UUID createdBy;
    UUID archivedBy;
    Instant archivedAt;
}
