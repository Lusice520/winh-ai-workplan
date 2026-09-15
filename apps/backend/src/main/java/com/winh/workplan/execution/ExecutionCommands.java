package com.winh.workplan.execution;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
final class ExecutionCommands {
    private ExecutionCommands(){}
    record StageCommand(@NotNull UUID requestId,@NotNull Long version,@NotNull Long objectVersion,
        @NotBlank String action,@NotNull LocalDate occurredOn,@NotBlank String note,Integer progress){}
    record ProfileCommand(@NotNull UUID requestId,@NotNull Long version,@NotNull Long objectVersion,
        @NotNull Boolean requiresReceipt,@NotNull Boolean requiresInstallation,String brand,String model,String supplier,@NotBlank String reason){}
    record ItemCommand(@NotNull UUID requestId,@NotNull Long version,@NotNull Long objectVersion,
        @NotBlank String kind,@NotNull BigDecimal quantity,@NotNull LocalDate occurredOn,@NotBlank String evidence,
        List<UUID> fileVersionIds,UUID verifierId){}
    record Decision(@NotNull UUID requestId,@NotNull Long version,@NotNull Long objectVersion,
        @NotBlank String action,@NotBlank String note){}
    record MilestoneCommand(@NotNull UUID requestId,@NotNull Long version,@NotNull Long objectVersion,
        @NotNull LocalDate occurredOn,@NotBlank String evidence,List<UUID> fileVersionIds,@NotNull UUID verifierId){}
}
