package com.winh.workplan.presales;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.*;
public final class PresalesCommands {
    private PresalesCommands() {}
    public record InitiationInput(@NotNull UUID requestId, Long version, @NotBlank String purpose,
        @NotBlank String scope, @NotBlank String expectedOutputs, @NotBlank String exitConditions,
        @NotNull BigDecimal requestedHours, @NotNull BigDecimal requestedCost,
        @NotNull LocalDate startsOn, @NotNull LocalDate endsOn) {}
    public record SubmitInput(@NotNull UUID requestId, @NotNull Long version) {}
    public record ReviewInput(@NotNull UUID requestId, @NotNull Long version, @NotBlank String decision,
        @NotBlank String comment, BigDecimal approvedHours, BigDecimal approvedCost) {}
    public record ActionInput(@NotNull UUID requestId, @NotNull Long version, @NotNull UUID ownerAccountId,
        LocalDate dueDate, @NotBlank String status, String note) {}
    public record DeliverableInput(@NotNull UUID requestId, @NotNull Long version, @NotBlank String title,
        @NotBlank String kind, @NotBlank String scope, @NotBlank String content, @NotBlank String changeNote,
        @NotBlank String status) {}
    public record InvestmentInput(@NotNull UUID requestId, @NotBlank String kind, BigDecimal hours,
        BigDecimal cost, @NotNull LocalDate occurredOn, @NotBlank String description, UUID commitmentId, UUID reversesId) {}
    public record QuoteInput(@NotNull UUID requestId, @NotBlank String feasibility, @NotBlank String scope,
        @NotBlank String estimate, @NotBlank String priceAuthorization, @NotBlank String constraints,
        @NotBlank String assumptionsRisks, @NotBlank String finalVersion, @NotEmpty List<UUID> deliverableIds) {}
}
