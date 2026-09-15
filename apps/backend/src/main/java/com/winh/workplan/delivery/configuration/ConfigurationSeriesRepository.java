package com.winh.workplan.delivery.configuration;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

interface ConfigurationSeriesRepository extends JpaRepository<ConfigurationSeries, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ConfigurationSeries c where c.id = :id")
    Optional<ConfigurationSeries> lock(@Param("id") UUID id);
}
