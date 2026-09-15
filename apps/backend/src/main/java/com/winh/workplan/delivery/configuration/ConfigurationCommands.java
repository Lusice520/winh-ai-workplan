package com.winh.workplan.delivery.configuration;

import static com.winh.workplan.delivery.configuration.ConfigurationDefinitions.*;
import java.util.UUID;

final class ConfigurationCommands {
    private ConfigurationCommands() {}
    record Create(UUID requestId, String kind, String name, String versionNote, Template template, Policy policy) {}
    record Update(UUID requestId, Long version, String name, String versionNote, Template template, Policy policy) {}
    record Transition(UUID requestId, Long version, String reason) {}
}
