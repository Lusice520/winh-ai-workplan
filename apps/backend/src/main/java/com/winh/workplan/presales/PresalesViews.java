package com.winh.workplan.presales;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
public final class PresalesViews {
    private PresalesViews() {}
    public record InitiationView(UUID id, long version, String purpose, String scope, String expectedOutputs,
        String exitConditions, BigDecimal requestedHours, BigDecimal requestedCost, BigDecimal approvedHours,
        BigDecimal approvedCost, LocalDate startsOn, LocalDate endsOn, String status, UUID submittedBy,
        String submittedByName, Instant submittedAt, String reviewedByName, Instant reviewedAt, String reviewComment) {}
    public record ActionView(UUID id, long version, String actionKey, String name, String status,
        UUID ownerAccountId, String ownerName, LocalDate dueDate, String note, List<DeliverableView> deliverables) {}
    public record DeliverableView(UUID id, String title, String kind, String scope, String content, int versionNumber,
        String changeNote, String status, String createdByName, Instant createdAt) {}
    public record InvestmentView(UUID id, String kind, BigDecimal hours, BigDecimal cost, LocalDate occurredOn,
        String description, UUID commitmentId, UUID reversesId, boolean reversed, String createdByName) {}
    public record QuoteView(UUID id, long version, String feasibility, String scope, String estimate,
        String priceAuthorization, String constraints, String assumptionsRisks, String finalVersion,
        List<UUID> deliverableIds, String status, boolean current, UUID submittedBy, String submittedByName,
        String reviewedByName, String reviewComment, Instant createdAt, Instant reviewedAt) {}
    public record Workspace(List<ActionView> actions, List<InitiationView> initiations,
        List<InvestmentView> investments, List<QuoteView> quoteReviews, BigDecimal committedHours,
        BigDecimal committedCost, BigDecimal actualHours, BigDecimal actualCost, boolean investmentDetailsVisible,
        List<String> allowedActions) {}
}
