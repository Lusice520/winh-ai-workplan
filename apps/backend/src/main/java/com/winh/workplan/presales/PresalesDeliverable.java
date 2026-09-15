package com.winh.workplan.presales;
import com.winh.workplan.business.BusinessRecord;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
import jakarta.persistence.*;
@Entity @Table(name = "presales_deliverable", uniqueConstraints = @UniqueConstraint(columnNames = {"action_id", "version_number"}))
class PresalesDeliverable extends BusinessRecord {
    @Column(nullable = false) UUID projectId;
    @Column(nullable = false) UUID actionId;
    @Column(nullable = false) int versionNumber;
    @Column(nullable = false, length = 160) String title;
    @Column(nullable = false, length = 40) String kind;
    @Column(nullable = false, length = 2000) String scope;
    @Column(nullable = false, length = 12000) String content;
    @Column(nullable = false, length = 2000) String changeNote;
    @Column(nullable = false, length = 24) String status;
    @Column(nullable = false) UUID createdBy;
    protected PresalesDeliverable() {}
}
