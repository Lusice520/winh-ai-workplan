package com.winh.workplan.presales;
import com.winh.workplan.business.BusinessRecord;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
import jakarta.persistence.*;
@Entity @Table(name = "presales_investment")
class PresalesInvestment extends BusinessRecord {
    @Column(nullable = false) UUID projectId;
    @Column(nullable = false) UUID initiationId;
    @Column(nullable = false, length = 24) String kind;
    @Column(nullable = false, precision = 16, scale = 2) BigDecimal hours;
    @Column(nullable = false, precision = 16, scale = 2) BigDecimal cost;
    @Column(nullable = false) LocalDate occurredOn;
    @Column(nullable = false, length = 2000) String description;
    @Column() UUID commitmentId;
    @Column() UUID reversesId;
    @Column(nullable = false) boolean reversed;
    @Column(nullable = false) UUID createdBy;
    protected PresalesInvestment() {}
}
