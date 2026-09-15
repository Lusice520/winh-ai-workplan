package com.winh.workplan.handover;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

public final class EarlyStartCommands {
    private EarlyStartCommands() {}
    public record ApplicationInput(UUID requestId, Long version, String title, String scope, List<String> scopeItems,
        BigDecimal requestedHours, BigDecimal requestedCost, LocalDate startsOn, LocalDate endsOn, UUID riskOwnerId,
        String stopConditions, String missingItems, String regularizationPlan) {}
    public record Submit(UUID requestId, Long version) {}
    public record Review(UUID requestId, Long version, String decision, String comment, BigDecimal approvedHours, BigDecimal approvedCost) {}
    public record LedgerInput(UUID requestId, String kind, String commitmentType, String scopeItem, UUID ownerId,
        LocalDate occurredOn, BigDecimal hours, BigDecimal cost, String evidence, UUID commitmentId, UUID reversesId, UUID allowanceId, String overrunReason) {}
    public record AllowanceInput(UUID requestId, Long version, String scopeItem, BigDecimal hours, BigDecimal cost,
        LocalDate startsOn, LocalDate endsOn, String reason) {}
    public record Finish(UUID requestId, Long version, String reason) {}
}
