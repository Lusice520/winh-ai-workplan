package com.winh.workplan.crm;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.validation.constraints.*;

public final class CrmCommands {
    private CrmCommands() {}
    public record CustomerInput(@NotNull UUID requestId, Long version, @NotBlank String name,
        String shortName, @NotBlank String kind, String identifier, String industry, String region,
        @NotBlank String source, @NotNull UUID ownerAccountId, @NotBlank String status) {}
    public record ContactInput(@NotNull UUID requestId, Long version, @NotBlank String name,
        String position, String phone, @Email String email, @NotBlank String status) {}
    public record MergeInput(@NotNull UUID requestId, @NotNull UUID sourceId, @NotNull Long version,
        @NotNull Long sourceVersion, @NotBlank String fieldPolicy, @NotBlank String reason) {}
    public record OpportunityInput(@NotNull UUID requestId, Long version, @NotNull UUID customerId,
        @NotBlank String title, String eventKey, @NotNull UUID ownerAccountId, @NotBlank String source,
        String procurementMethod, BigDecimal estimatedAmount, LocalDate targetDate, String background) {}
    public record ClassificationInput(@NotNull UUID requestId, @NotNull Long version,
        String grade, String progress, @NotBlank String reason) {}
    public record ActivityInput(@NotNull UUID requestId, @NotNull Long version, @NotBlank String fact,
        String nextAction, UUID assigneeId, LocalDate dueDate) {}
    public record ResultInput(@NotNull UUID requestId, @NotNull Long version, @NotBlank String result,
        @NotBlank String status, @NotBlank String reasonCategory, @NotBlank String reason, @NotBlank String evidence) {}
    public record ReopenInput(@NotNull UUID requestId, @NotNull Long version, @NotBlank String reason) {}
}
