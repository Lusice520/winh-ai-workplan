package com.winh.workplan.handover;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
@Entity @Table(name="handover_item")
class HandoverItem extends BusinessRecord {
@Column(nullable=false) UUID caseId;
@Column(nullable=false,length=40) String itemKey;
@Column(nullable=false,length=80) String name;
@Column(nullable=false,length=40) String groupKey;
@Column(nullable=false,length=24) String applicability;
@Column(nullable=false) boolean applicable=true;
@Column(nullable=false) int sortOrder;
@Column(nullable=false) UUID ownerId;
@Column(nullable=false) LocalDate dueDate;
@Column(length=24) String referenceKind;
UUID referenceId;
@Column(length=2000) String note;
}
