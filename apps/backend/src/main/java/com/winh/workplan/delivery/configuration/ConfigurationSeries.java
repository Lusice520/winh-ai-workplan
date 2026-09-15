package com.winh.workplan.delivery.configuration;

import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;

@Entity @Table(name = "delivery_configuration_series")
class ConfigurationSeries extends BusinessRecord {
    @Column(nullable = false, length = 32) String kind;
    @Column(nullable = false) int latestEdition;
    protected ConfigurationSeries() {}
}
