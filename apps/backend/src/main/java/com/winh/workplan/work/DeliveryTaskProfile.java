package com.winh.workplan.work;

import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity @Table(name="delivery_task_profile")
class DeliveryTaskProfile extends BusinessRecord {
    @Column(nullable=false) UUID projectId;
    @Column(nullable=false) UUID workPackageId;
    @Column(nullable=false) UUID stageId;
    @Column(nullable=false) LocalDate startsOn;
    @Column(precision=8,scale=1) BigDecimal estimatedDays;
    @Column(nullable=false,length=4000) String acceptanceCriteria;
    @Column(nullable=false,columnDefinition="text") String itemIdsJson="[]";
    @Column(nullable=false,length=64) String scopeHash;
    @Column(nullable=false) int baselineVersion;
    @Column(nullable=false) int progress;
    @Column LocalDate actualStartedOn;
    @Column LocalDate lastActualOn;
    @Column LocalDate actualCompletedOn;
    @Column(nullable=false,columnDefinition="text") String filesJson="[]";
    protected DeliveryTaskProfile(){}
}
