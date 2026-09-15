package com.winh.workplan.delivery.configuration;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ConfigurationEditionRepository extends JpaRepository<ConfigurationEdition, UUID> {
    List<ConfigurationEdition> findAllByOrderByUpdatedAtDesc();
    List<ConfigurationEdition> findAllBySeriesIdOrderByEditionDesc(UUID seriesId);
    List<ConfigurationEdition> findAllByKindAndStatusOrderByUpdatedAtDesc(String kind, String status);
    boolean existsBySeriesIdAndStatus(UUID seriesId, String status);
}
