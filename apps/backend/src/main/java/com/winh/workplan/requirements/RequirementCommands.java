package com.winh.workplan.requirements;
import java.time.LocalDate;
import java.util.UUID;
import jakarta.validation.constraints.*;
public final class RequirementCommands {
    private RequirementCommands(){}
    public record CreateRequirement(@NotNull UUID requestId,@NotNull UUID projectId,@NotBlank String title,
        @NotBlank String originalText,@NotBlank String source,@NotBlank String requester,@NotNull UUID ownerAccountId,
        @NotNull UUID verifierAccountId,@NotBlank String priority,LocalDate expectedOn,boolean importantCustomer){}
    public record EditRequirement(@NotNull UUID requestId,@NotNull Long version,@NotNull UUID ownerAccountId,
        @NotNull UUID verifierAccountId,@NotBlank String priority,LocalDate expectedOn,@NotBlank String reason){}
    public record AssessRequirement(@NotNull UUID requestId,@NotNull Long version,@NotBlank String clarification,
        @NotBlank String category,@NotBlank String scopeImpact,@NotBlank String technicalImpact,@NotBlank String scheduleImpact,
        @NotBlank String costImpact,@NotBlank String contractImpact,@NotBlank String acceptanceImpact,
        @NotBlank String safetyImpact,boolean baselineImpact){}
    public record RouteRequirement(@NotNull UUID requestId,@NotNull Long version,@NotBlank String disposition,
        @NotBlank String reason,UUID existingWorkItemId){}
    public record CompleteRequirement(@NotNull UUID requestId,@NotNull Long version,@NotBlank String evidence){}
    public record VerifyRequirement(@NotNull UUID requestId,@NotNull Long version,@NotBlank String decision,
        @NotBlank String comment,String customerEvidence){}
    public record ReopenRequirement(@NotNull UUID requestId,@NotNull Long version,@NotBlank String reason){}
}
