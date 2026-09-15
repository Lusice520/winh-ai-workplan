package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import com.winh.workplan.project.ProjectDirectory.MemberRoles;
import com.winh.workplan.project.ProjectDirectory.RoleChange;
import com.winh.workplan.project.ProjectResponsibilityContributor.Responsibility;
import java.util.*;
import java.time.*;
import java.math.BigDecimal;

final class DeliveryTransfers {
    private DeliveryTransfers() {}
    record ObjectMove(ObjectFact before,Content after) {}
    record ResourceMove(ResourceFact before,ResourceRequest after) {}
    record FindingMove(FindingFact before,Finding after) {}
    record Mapping(MemberRoles from,MemberRoles to,Header beforeHeader,Header afterHeader,
        List<ObjectMove> objects,List<ResourceMove> resources,List<FindingMove> findings,List<Responsibility> related) {}
    record Preview(String hash,Mapping mapping) {}
    record Permissions(List<RoleChange> items) {}
    record ResourceSignature(UUID resourceId,String status,Commitment commitment,UUID signedBy,Instant signedAt,String overlapHash) {}
    record Signatures(List<ResourceSignature> items) {}
    record View(UUID id,long version,String status,UUID fromId,String fromName,UUID toId,String toName,Mapping mapping,String mappingHash,
        List<RoleChange> permissions,List<ResourceSignature> signatures,String basis,UUID submittedBy,Instant submittedAt,
        UUID acceptedBy,Instant acceptedAt,String acceptanceNote,UUID decidedBy,Instant effectiveAt,String decisionNote) {}
    record Create(UUID requestId,Long version,UUID fromId,UUID toId,String mappingHash,List<String> fromRoles,List<String> toRoles,String basis) {}
    record Decide(UUID requestId,Long version,String action,String note) {}
    record Sign(UUID requestId,Long version,UUID resourceId,String decision,Commitment commitment) {}
    record Allocation(UUID resourceId,UUID projectId,String projectName,LocalDate startsOn,LocalDate endsOn,BigDecimal dailyHours,boolean proposed) {}
    record Overlaps(ResourceRequest request,BigDecimal peakHours,List<Allocation> allocations) {}
}
