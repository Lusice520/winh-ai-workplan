package com.winh.workplan.contracts;
import java.util.UUID;
import java.math.BigDecimal;
import java.time.LocalDate;
public final class ContractCommands {
    private ContractCommands() {}
    public record MasterInput(UUID requestId, Long version, UUID projectId, String number, String title,
        String partyA, String partyB, BigDecimal amount, LocalDate signedOn, LocalDate effectiveOn, String scope) {}
    public record NodeInput(UUID requestId, Long version, UUID recordId, String title, String kind, LocalDate dueDate, BigDecimal amount, String conditions) {}
    public record CompleteNode(UUID requestId, Long version, LocalDate completedOn, String evidence) {}
    public record CorrectNode(UUID requestId, Long version, Long contractVersion, String kind, String reason,
        UUID recordId, String title, LocalDate dueDate, BigDecimal amount, String conditions,
        LocalDate completedOn, String evidence) {}
    public record RecordInput(UUID requestId, Long version, String kind, String title, String description, LocalDate signedOn, UUID fileVersionId, BigDecimal amountAfter) {}
    public record LinkFile(UUID requestId, Long version, UUID fileVersionId, String kind) {}
    public record SubmitArchive(UUID requestId, Long version, String note) {}
    public record ReviewArchive(UUID requestId, Long version, String decision, String comment) {}
    public record MakePrimary(UUID requestId, Long version, String reason) {}
}
