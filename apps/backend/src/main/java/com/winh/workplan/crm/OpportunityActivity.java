package com.winh.workplan.crm;

import java.util.UUID;
import jakarta.persistence.*;
import com.winh.workplan.business.BusinessRecord;
import java.time.LocalDate;

@Entity
@Table(name = "crm_opportunity_activity")
class OpportunityActivity extends BusinessRecord {
    @Column(nullable = false) UUID opportunityId;
    @Column(nullable = false, length = 4000) String fact;
    @Column(length = 1000) String nextAction;
    @Column() UUID assigneeId;
    @Column() LocalDate dueDate;
    @Column(nullable = false) UUID recordedBy;
    protected OpportunityActivity() {}
}
