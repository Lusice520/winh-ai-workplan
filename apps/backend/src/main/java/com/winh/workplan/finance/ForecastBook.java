package com.winh.workplan.finance;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name="income_forecast_book")
class ForecastBook extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false,length=7) String period;
    @Column(nullable=false,length=3) String currency;
    @Column UUID currentRevisionId;
    @Column UUID draftRevisionId;
    protected ForecastBook(){}
}
