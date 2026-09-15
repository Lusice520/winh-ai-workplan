package com.winh.workplan.handover;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
@Entity @Table(name="early_start_ledger")
class EarlyStartLedger extends BusinessRecord {
@Column(nullable=false) UUID applicationId;
@Column(nullable=false,length=24) String kind;
@Column(nullable=false,length=24) String commitmentType;
@Column(nullable=false,length=160) String scopeItem;
@Column(nullable=false) UUID ownerId;
@Column(nullable=false) LocalDate occurredOn;
@Column(nullable=false,precision=16,scale=2) BigDecimal hours;
@Column(nullable=false,precision=16,scale=2) BigDecimal cost;
@Column(nullable=false,length=4000) String evidence;
@Column(nullable=false) UUID createdBy;
UUID commitmentId;
UUID reversesId;
UUID allowanceId;
@Column(nullable=false) boolean reversed;
}
