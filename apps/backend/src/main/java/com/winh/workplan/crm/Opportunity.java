package com.winh.workplan.crm;

import java.util.UUID;
import jakarta.persistence.*;
import com.winh.workplan.business.BusinessRecord;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "crm_opportunity", uniqueConstraints = @UniqueConstraint(columnNames = {"customer_id", "event_key"}))
class Opportunity extends BusinessRecord {
    @Column(nullable = false, unique = true, length = 40) String code;
    @Column(nullable = false) UUID customerId;
    @Column(nullable = false, length = 160) String title;
    @Column(length = 120) String eventKey;
    @Column(nullable = false) UUID ownerAccountId;
    @Column(nullable = false) UUID organizationUnitId;
    @Column(nullable = false, length = 120) String source;
    @Column(nullable = false, length = 8) String grade;
    @Column(nullable = false, length = 32) String progress;
    @Column(nullable = false, length = 24) String procurementMethod;
    @Column(precision = 16, scale = 2) BigDecimal estimatedAmount;
    @Column() LocalDate targetDate;
    @Column(length = 8000) String background;
    @Column(nullable = false, length = 24) String status;
    @Column(nullable = false, length = 32) String result;
    @Column(unique = true) UUID projectId;
    protected Opportunity() {}
}
