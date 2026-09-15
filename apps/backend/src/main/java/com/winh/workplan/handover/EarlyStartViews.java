package com.winh.workplan.handover;
import com.winh.workplan.business.BusinessHistory.EventView;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public final class EarlyStartViews {
    private EarlyStartViews() {}
    public record RequestFacts(UUID projectId, String title, String scope, List<String> scopeItems,
        BigDecimal requestedHours, BigDecimal requestedCost, LocalDate startsOn, LocalDate endsOn,
        UUID riskOwnerId, String stopConditions, String missingItems, String regularizationPlan) {}
    public record Application(UUID id, long version, RequestFacts request, String riskOwnerName, String status,
        String effectiveStatus, BigDecimal approvedHours, BigDecimal approvedCost, UUID submittedBy,
        String submittedByName, String approvedByName, Instant approvedAt, UUID regularizationPackageId,
        String finishReason, LedgerPolicy.Totals totals) {}
    public record ReviewRound(UUID id, long version, UUID applicationId, String status, RequestFacts snapshot,
        UUID submittedBy, String submittedByName, String reviewedByName, Instant createdAt, Instant reviewedAt, String comment) {}
    public record Ledger(UUID id, UUID applicationId, String kind, String commitmentType, String scopeItem, UUID ownerId,
        String ownerName, LocalDate occurredOn, BigDecimal hours, BigDecimal cost, String evidence,
        UUID commitmentId, UUID reversesId, UUID allowanceId, boolean reversed, String recordedByName) {}
    public record Allowance(UUID id, UUID applicationId, String scopeItem, BigDecimal hours, BigDecimal cost,
        LocalDate startsOn, LocalDate endsOn, String reason, String approvedByName, LedgerPolicy.Totals totals) {}
    public record Workspace(List<Application> applications, List<ReviewRound> reviews, List<Ledger> ledger,
        List<Allowance> allowances, boolean ledgerVisible, List<EventView> history, List<String> allowedActions) {}
}
