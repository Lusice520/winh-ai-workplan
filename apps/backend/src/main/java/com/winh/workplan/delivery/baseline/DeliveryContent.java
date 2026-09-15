package com.winh.workplan.delivery.baseline;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Fixed domain fields, shared by commands and immutable review snapshots. */
public final class DeliveryContent {
    private DeliveryContent() {}
    public record Header(UUID projectManagerId, UUID technicalLeadId, String projectType, String riskLevel,
            String scopeAcceptance, String acceptanceCriteria, String timeConstraints, String handoverFollowups) {}
    public record Stage(String templateCode, String title, Boolean applicable, String applicabilityReason,
            String differenceReason, UUID ownerId, LocalDate startsOn, LocalDate endsOn,
            List<UUID> predecessorIds, List<UUID> parallelIds, Boolean focus,
            List<String> actions, List<String> deliverables, String completionCriteria) {}
    public record Milestone(String title, String kind, LocalDate dueDate, UUID ownerId, UUID stageId,
            UUID contractNodeId, String sourceNote, String acceptanceCriteria) {}
    public record Item(String title, String category, String specification, BigDecimal quantity, String unit,
            String acceptanceScope, UUID stageId, UUID workPackageId, UUID milestoneId,
            Boolean procurementNeeded, String procurementNote) {}
    public record WorkPackage(String title, String scope, String deliverables, String acceptanceCriteria,
            UUID ownerId, UUID verifierId, UUID stageId, LocalDate startsOn, LocalDate endsOn,
            String resourceNotes, List<UUID> itemIds, List<UUID> milestoneIds) {}
    public record Plan(String title, String kind, UUID stageId, UUID workPackageId, LocalDate startsOn,
            LocalDate endsOn, LocalDate deliveryWindowStart, LocalDate deliveryWindowEnd,
            List<UUID> dependsOnIds, String resourceConstraints) {}
    public record Budget(String mode, String scope, List<UUID> authorizedStageIds, BigDecimal authorizedCap,
            LocalDate expiresOn, LocalDate nextCompletionOn, String remainingScope, List<BudgetLine> lines) {}
    public record BudgetLine(String title, String category, BigDecimal amount, UUID stageId, UUID workPackageId,
            UUID resourceRequestId, UUID itemId, String basis) {}
    public record Content(Stage stage, Milestone milestone, Item item, WorkPackage workPackage, Plan plan, Budget budget) {
        public static Content of(Stage stage) { return new Content(stage, null, null, null, null, null); }
        public String kind() {
            if (stage != null) return "STAGE";
            if (milestone != null) return "MILESTONE";
            if (item != null) return "ITEM";
            if (workPackage != null) return "WORK_PACKAGE";
            if (plan != null) return "PLAN";
            if (budget != null) return "BUDGET";
            return null;
        }
        public String title() {
            return switch (kind()) {
                case "STAGE" -> stage.title(); case "MILESTONE" -> milestone.title();
                case "ITEM" -> item.title(); case "WORK_PACKAGE" -> workPackage.title();
                case "PLAN" -> plan.title(); default -> "实施预算";
            };
        }
    }
    public record ResourceRequest(UUID workPackageId, UUID personId, UUID committerId,
            LocalDate startsOn, LocalDate endsOn, BigDecimal dailyHours, String requestNote) {}
    public record Commitment(BigDecimal dailyCapacity, String conclusion, String impact, String escalationPath) {}
    public record Finding(String title, String kind, String impactCategory, String riskLevel,
            UUID ownerId, UUID verifierId, LocalDate dueDate, String closingCriteria, String impactScope,
            UUID escalationOwnerId, String escalationPath) {}
}
