package com.winh.workplan.finance;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name="income_forecast_revision")
class ForecastRevision extends BusinessRecord {
    @Column(nullable=false) UUID bookId;
    @Column(nullable=false) int number;
    @Column(nullable=false,length=16) String status="DRAFT";
    @Column(nullable=false,columnDefinition="text") String linesJson="[]";
    @Column(nullable=false,length=4000) String reason;
    @Column(nullable=false) UUID editedBy;
    @Column UUID publishedBy;
    @Column Instant publishedAt;
    protected ForecastRevision(){}
}
