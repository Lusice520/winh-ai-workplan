package com.winh.workplan.handover;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
@Entity @Table(name="early_closure_allowance")
class EarlyClosureAllowance extends BusinessRecord {
@Column(nullable=false) UUID applicationId;
@Column(nullable=false,length=160) String scopeItem;
@Column(nullable=false,precision=16,scale=2) BigDecimal hours;
@Column(nullable=false,precision=16,scale=2) BigDecimal cost;
@Column(nullable=false) LocalDate startsOn;
@Column(nullable=false) LocalDate endsOn;
@Column(nullable=false,length=4000) String reason;
@Column(nullable=false) UUID approvedBy;
}
