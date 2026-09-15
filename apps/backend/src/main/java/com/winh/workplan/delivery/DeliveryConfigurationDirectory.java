package com.winh.workplan.delivery;

import com.winh.workplan.delivery.configuration.ConfigurationDefinitions.Policy;
import com.winh.workplan.delivery.configuration.ConfigurationDefinitions.Template;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.List;
import java.util.UUID;

/** Published configuration snapshots; project instances never read another module's repositories. */
public interface DeliveryConfigurationDirectory {
    List<PublishedConfiguration> available(SessionPrincipal actor, UUID projectId, String kind);
    PublishedConfiguration requireSelectable(SessionPrincipal actor, UUID projectId, UUID editionId, String kind);
    record PublishedConfiguration(UUID id, UUID seriesId, int edition, String name, String kind,
            Template template, Policy policy, String snapshotHash) {}
}
