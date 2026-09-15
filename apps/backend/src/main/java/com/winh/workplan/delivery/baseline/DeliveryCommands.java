package com.winh.workplan.delivery.baseline;
import java.util.UUID;
import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
final class DeliveryCommands {
    private DeliveryCommands() {}
    record Initialize(UUID requestId, Header header) {}
    record UpdateHeader(UUID requestId, Long version, Header header, String reason) {}
    record SelectConfiguration(UUID requestId, Long version, String kind, UUID editionId, String reason) {}
    record SaveObject(UUID requestId, Long version, Long objectVersion, UUID existingWorkItemId,
        Content content, String reason, String impact, String basis) {}
    record ArchiveObject(UUID requestId, Long version, Long objectVersion, String reason, String impact, String basis) {}
    record SaveResource(UUID requestId, Long version, Long resourceVersion, ResourceRequest request, String reason) {}
    record CommitResource(UUID requestId, Long version, Long resourceVersion, String decision, Commitment commitment, String reason) {}
    record SaveFinding(UUID requestId, Long version, Long findingVersion, Finding finding, String reason) {}
    record ResolveFinding(UUID requestId, Long version, Long findingVersion, String action, String evidence) {}
    record Submit(UUID requestId, Long version, String note) {}
    record Decision(UUID requestId, Long version, Long roundVersion, String decision, String comment) {}
    record DecideChange(UUID requestId, Long version, Long changeVersion, String decision, String comment) {}
}
