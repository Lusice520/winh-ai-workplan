package com.winh.workplan.work;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
final class DeliveryTaskCommands {
    private DeliveryTaskCommands(){}
    record Plan(@NotNull UUID requestId,@NotNull Long parentVersion,UUID existingTaskId,Long sourceVersion,
        Long version,Long workVersion,@NotBlank String title,@NotBlank String description,
        @NotBlank String acceptanceCriteria,@NotNull UUID ownerId,@NotNull UUID verifierId,
        @NotNull LocalDate startsOn,@NotNull LocalDate dueDate,BigDecimal estimatedDays,List<UUID> itemIds,@NotBlank String reason){}
    record Action(@NotNull UUID requestId,@NotNull Long version,@NotNull Long workVersion,
        @NotBlank String action,@NotBlank String note,LocalDate occurredOn,
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using=TaskProgressDeserializer.class) Integer progress,List<UUID> fileVersionIds){}
}
