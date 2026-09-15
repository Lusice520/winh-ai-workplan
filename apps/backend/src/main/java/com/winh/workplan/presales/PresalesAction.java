package com.winh.workplan.presales;
import com.winh.workplan.business.BusinessRecord;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
import jakarta.persistence.*;
@Entity @Table(name = "presales_action", uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "action_key"}))
class PresalesAction extends BusinessRecord {
    @Column(nullable = false) UUID projectId;
    @Column(nullable = false, length = 40) String actionKey;
    @Column(nullable = false, length = 120) String name;
    @Column(nullable = false) int sortOrder;
    @Column(nullable = false, length = 24) String status;
    @Column(nullable = false) UUID ownerAccountId;
    @Column() LocalDate dueDate;
    @Column(length = 2000) String note;
    protected PresalesAction() {}
}
