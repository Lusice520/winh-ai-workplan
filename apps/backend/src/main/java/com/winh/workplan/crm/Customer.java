package com.winh.workplan.crm;

import java.util.UUID;
import jakarta.persistence.*;
import com.winh.workplan.business.BusinessRecord;

@Entity
@Table(name = "crm_customer")
class Customer extends BusinessRecord {
    @Column(nullable = false, unique = true, length = 40) String code;
    @Column(nullable = false, length = 160) String name;
    @Column(nullable = false, length = 160) String normalizedName;
    @Column(length = 80) String shortName;
    @Column(nullable = false, length = 24) String kind;
    @Column(length = 80) String identifier;
    @Column(unique = true, length = 80) String activeIdentifier;
    @Column(length = 80) String industry;
    @Column(length = 120) String region;
    @Column(nullable = false, length = 120) String source;
    @Column(nullable = false) UUID ownerAccountId;
    @Column(nullable = false) UUID organizationUnitId;
    @Column(nullable = false, length = 24) String status;
    @Column() UUID mergedIntoId;
    protected Customer() {}
}
