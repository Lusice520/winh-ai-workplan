package com.winh.workplan.finance;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
final class IncomeCommands {
    private IncomeCommands(){}
    record Source(UUID contractId,Long contractVersion,UUID nodeId,Long nodeVersion){}
    record IncomeReference(@NotNull UUID id,@NotNull Long version){}
    record ForecastLine(@NotNull UUID id,@NotBlank String title,@NotNull LocalDate plannedOn,@NotNull BigDecimal amount,
        @NotBlank String sourceType,@Valid Source source,@NotBlank String sourceNote,@Valid IncomeReference incomeReference,List<UUID> fileVersionIds){}
    record ForecastSave(@NotNull UUID requestId,@NotBlank String period,@NotBlank String currency,Long bookVersion,Long draftVersion,
        @NotEmpty @Size(max=100) List<@Valid ForecastLine> lines,@NotBlank String reason){}
    record ForecastAction(@NotNull UUID requestId,@NotNull Long bookVersion,@NotNull Long draftVersion,@NotBlank String action,@NotBlank String reason){}
    record IncomeSave(@NotNull UUID requestId,Long version,@NotBlank String kind,@NotBlank String title,BigDecimal amount,
        @NotBlank String currency,@NotNull LocalDate occurredOn,@NotBlank String sourceNote,@Valid Source source,
        UUID forecastRevisionId,UUID forecastLineId,String unplannedReason,UUID originalIncomeId,@NotNull UUID confirmerId,
        List<UUID> fileVersionIds,@NotBlank String reason){}
    record IncomeAction(@NotNull UUID requestId,@NotNull Long version,@NotBlank String action,@NotBlank String reason){}
}
