package com.winh.workplan.presales;
import com.winh.workplan.business.BusinessRecord;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
import jakarta.persistence.*;
@Entity @Table(name = "presales_initiation")
class PresalesInitiation extends BusinessRecord {
    @Column(nullable = false) UUID projectId;
    @Column(nullable = false, length = 2000) String purpose;
    @Column(nullable = false, length = 2000) String scope;
    @Column(nullable = false, length = 2000) String expectedOutputs;
    @Column(nullable = false, length = 2000) String exitConditions;
    @Column(nullable = false, precision = 16, scale = 2) BigDecimal requestedHours;
    @Column(nullable = false, precision = 16, scale = 2) BigDecimal requestedCost;
    @Column(precision = 16, scale = 2) BigDecimal approvedHours;
    @Column(precision = 16, scale = 2) BigDecimal approvedCost;
    @Column(nullable = false) LocalDate startsOn;
    @Column(nullable = false) LocalDate endsOn;
    @Column(nullable = false, length = 24) String status;
    @Column() UUID submittedBy;
    @Column() Instant submittedAt;
    @Column() UUID reviewedBy;
    @Column() Instant reviewedAt;
    @Column(length = 2000) String reviewComment;
    protected PresalesInitiation() {}
}
