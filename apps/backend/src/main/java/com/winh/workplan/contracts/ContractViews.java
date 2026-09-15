package com.winh.workplan.contracts;
import com.winh.workplan.business.BusinessHistory.EventView;
import com.winh.workplan.files.FileDirectory.VersionReference;
import java.util.*;
import java.math.BigDecimal;
import java.time.*;
public final class ContractViews {
    private ContractViews() {}
    public record Master(UUID id, long version, UUID projectId, String projectCode, String projectName, UUID opportunityId,
        UUID customerId, String customerName, String number, String title, String partyA, String partyB, BigDecimal amount,
        LocalDate signedOn, LocalDate effectiveOn, String scope, String status, String archiveStatus, boolean primaryContract,
        boolean everArchived, String salesOwnerName, String archivedByName, Instant archivedAt, Instant updatedAt) {}
    public record Node(UUID id, long version, UUID recordId, String title, String kind, LocalDate dueDate, BigDecimal amount,
        String conditions, String status, LocalDate completedOn, String evidence, String completedByName) {}
    public record NodeFact(long version, UUID recordId, String title, String kind, LocalDate dueDate, BigDecimal amount,
        String conditions, String status, LocalDate completedOn, String evidence, UUID completedBy) {}
    public record NodeRevision(UUID id, UUID nodeId, String kind, NodeFact before, NodeFact after,
        String reason, String recordedByName, Instant createdAt) {}
    public record Amendment(UUID id, String kind, String title, String description, LocalDate signedOn, UUID fileVersionId,
        BigDecimal amountBefore, BigDecimal amountAfter, String createdByName, Instant createdAt) {}
    public record LinkedFile(UUID id, String kind, boolean active, VersionReference file) {}
    public record ArchiveReview(UUID id, long version, String status, String submissionNote, UUID submittedBy,
        String submitterName, String reviewerName, Instant createdAt, Instant reviewedAt, String reviewComment) {}
    public record Detail(Master contract, List<Node> nodes, List<NodeRevision> nodeHistory, List<Amendment> records, List<LinkedFile> files,
        List<ArchiveReview> archiveReviews, List<EventView> history, List<String> allowedActions, boolean sensitiveVisible,
        boolean filesVisible, List<String> missingItems) {}
}
