package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import com.winh.workplan.delivery.DeliveryConfigurationDirectory.PublishedConfiguration;
import java.time.Instant;
import java.util.*;

final class DeliveryScopes {
    private DeliveryScopes() {}
    static final Set<String> OPEN=Set.of("DRAFT","RETURNED","SUBMITTED");
    record Metadata(UUID requestId,Long version,String reason,String impact,String basis,UUID policyEditionId) {}
    record Action(UUID requestId,Long version,String action,String note,UUID objectId,UUID resourceId) {}
    record ResourceSave(UUID requestId,Long version,Long resourceVersion,ResourceRequest request,boolean releaseRequested,String reason) {}
    record ObjectEdit(ObjectFact proposed,Long originalVersion,Long workVersion,boolean adopted) {}
    record ResourceEdit(ResourceFact proposed,Long originalVersion,boolean releaseRequested) {}
    record Draft(List<ObjectEdit> objects,List<ResourceEdit> resources) {}
    record Frozen(int baseBaselineVersion,String baseHash,Snapshot reference,Snapshot candidate,Draft draft,
        String reason,String impact,String basis,UUID preparedBy) {}
    record Row(UUID id,long version,String status,int baseBaselineVersion,boolean stale,int objectCount,int resourceCount,
        UUID createdBy,UUID preparedBy,Instant createdAt,Instant updatedAt,String reason) {}
    record Round(UUID id,long version,int number,String status,String snapshotHash,UUID submittedBy,Instant submittedAt,
        UUID decidedBy,Instant decidedAt,String decisionNote,Integer baselineVersion) {}
    record ChangeEvent(UUID id,String action,UUID actorId,Instant at,String note) {}
    record View(Row change,Snapshot reference,Snapshot candidate,Draft draft,boolean budgetReadable,UUID finalApproverId,
        String impact,String basis,UUID selectedPolicyEditionId,
        List<String> problems,List<String> staleProblems,List<Round> rounds,List<ChangeEvent> events,List<String> allowedActions) {}
}
