package com.winh.workplan.project;
import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.*;
public final class ProjectCommands {
    private ProjectCommands() {}
    public record CreateProject(@NotNull UUID requestId, @NotNull UUID opportunityId, @NotNull UUID presalesOwnerId) {}
    public record EditProject(@NotNull UUID requestId, @NotNull Long version, @NotBlank String name, @NotBlank String focus, String background) {}
    public record SaveMember(@NotNull UUID requestId, @NotNull Long version, @NotNull UUID accountId,
        @NotNull List<String> roleCodes, boolean active, @NotBlank String reason) {}
}
