package com.winh.workplan.handover;
import java.time.LocalDate;
import java.util.UUID;

public final class HandoverCommands {
    private HandoverCommands() {}
    public record Initialize(UUID requestId, String projectType, UUID receiverId, LocalDate dueDate) {}
    public record Configure(UUID requestId, Long version, UUID receiverId, LocalDate dueDate, String reason) {}
    public record ItemInput(UUID requestId, Long version, UUID ownerId, LocalDate dueDate, boolean applicable,
        String referenceKind, UUID referenceId, String note) {}
    public record BasisInput(UUID requestId, Long version, String kind, UUID referenceId, String note) {}
    public record Submit(UUID requestId, Long version, String note) {}
    public record Review(UUID requestId, Long version, String decision, String comment) {}
    public record Reopen(UUID requestId, Long version, String reason) {}
}
