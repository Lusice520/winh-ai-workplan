package com.winh.workplan.delivery.configuration;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public final class ConfigurationDefinitions {
    private ConfigurationDefinitions() {}

    public record Template(List<String> projectTypes, List<Stage> stages) {}
    public record Stage(String code, String name, String applicability, String condition,
            String ownerRoleHint, List<String> predecessorCodes, List<String> parallelCodes,
            List<String> milestones, List<String> actions, List<String> deliverables, String completionCriteria) {}
    public record Policy(List<String> projectTypes, BigDecimal minimumBudget, BigDecimal maximumBudget,
            List<String> riskLevels, List<Reviewer> reviewers, UUID finalApproverId, String authorityBasis) {}
    public record Reviewer(UUID accountId, String scope) {}
    public record Definition(Template template, Policy policy) {}
    public record Problem(String field, String message) {}
}
