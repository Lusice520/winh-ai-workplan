package com.winh.workplan.delivery.configuration;

import static com.winh.workplan.delivery.configuration.ConfigurationDefinitions.*;
import com.winh.workplan.business.BusinessHistory;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

final class ConfigurationViews {
    private ConfigurationViews() {}
    record Row(UUID id, long version, UUID seriesId, int edition, String kind, String name, String status,
            List<String> projectTypes, int stageCount, int reviewerCount, String createdByName,
            String publishedByName, Instant publishedAt, Instant updatedAt) {}
    record Detail(Row configuration, String versionNote, Template template, Policy policy, String snapshotHash,
            List<PersonLabel> people, List<Problem> problems, List<Row> editions, String retirementReason,
            Instant retiredAt, List<BusinessHistory.EventView> history, List<String> allowedActions) {}
    record PersonLabel(UUID id, String name) {}
}
