package com.winh.workplan.presales;
import com.winh.workplan.business.BusinessRecord;
import java.util.UUID;
import java.time.*;
import java.math.BigDecimal;
import jakarta.persistence.*;
@Entity @Table(name = "presales_quote_review")
class PresalesQuoteReview extends BusinessRecord {
    @Column(nullable = false) UUID projectId;
    @Column(nullable = false, length = 2000) String feasibility;
    @Column(nullable = false, length = 2000) String scope;
    @Column(nullable = false, length = 2000) String estimate;
    @Column(nullable = false, length = 2000) String priceAuthorization;
    @Column(nullable = false, length = 2000) String constraints;
    @Column(nullable = false, length = 2000) String assumptionsRisks;
    @Column(nullable = false, length = 2000) String finalVersion;
    @Column(nullable = false, length = 4000) String deliverableIds;
    @Column(nullable = false, length = 8000) String actionSnapshot;
    @Column(nullable = false, length = 24) String status;
    @Column(nullable = false) UUID submittedBy;
    @Column() UUID reviewedBy;
    @Column() Instant reviewedAt;
    @Column(length = 2000) String reviewComment;
    protected PresalesQuoteReview() {}
}
