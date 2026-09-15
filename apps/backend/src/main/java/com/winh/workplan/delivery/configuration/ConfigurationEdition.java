package com.winh.workplan.delivery.configuration;

import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "delivery_configuration_edition")
class ConfigurationEdition extends BusinessRecord {
    @Column(nullable = false) UUID seriesId;
    @Column(nullable = false) int edition;
    @Column(nullable = false, length = 32) String kind;
    @Column(nullable = false, length = 160) String name;
    @Column(nullable = false, length = 24) String status = "DRAFT";
    @Column(nullable = false, length = 2000) String versionNote;
    @Column(nullable = false, columnDefinition = "text") String definitionJson;
    @Column(nullable = false) UUID createdBy;
    @Column UUID publishedBy;
    @Column Instant publishedAt;
    @Column(length = 64) String snapshotHash;
    @Column UUID retiredBy;
    @Column Instant retiredAt;
    @Column(length = 2000) String retirementReason;
    protected ConfigurationEdition() {}
}
