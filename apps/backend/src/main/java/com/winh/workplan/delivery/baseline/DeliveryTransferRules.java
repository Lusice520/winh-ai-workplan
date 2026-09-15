package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import java.util.*;
import java.time.LocalDate;

final class DeliveryTransferRules {
    private DeliveryTransferRules() {}
    static UUID replace(UUID id,UUID from,UUID to){return Objects.equals(id,from)?to:id;}
    static Header move(Header h,UUID from,UUID to){return new Header(replace(h.projectManagerId(),from,to),replace(h.technicalLeadId(),from,to),h.projectType(),h.riskLevel(),h.scopeAcceptance(),h.acceptanceCriteria(),h.timeConstraints(),h.handoverFollowups());}
    static Content move(Content content,UUID from,UUID to){
        if(content.stage()!=null){var x=content.stage();return Content.of(new Stage(x.templateCode(),x.title(),x.applicable(),x.applicabilityReason(),x.differenceReason(),replace(x.ownerId(),from,to),x.startsOn(),x.endsOn(),x.predecessorIds(),x.parallelIds(),x.focus(),x.actions(),x.deliverables(),x.completionCriteria()));}
        if(content.milestone()!=null){var x=content.milestone();return new Content(null,new Milestone(x.title(),x.kind(),x.dueDate(),replace(x.ownerId(),from,to),x.stageId(),x.contractNodeId(),x.sourceNote(),x.acceptanceCriteria()),null,null,null,null);}
        if(content.workPackage()!=null){var x=content.workPackage();return DeliveryRules.content(new Content(null,null,null,new WorkPackage(x.title(),x.scope(),x.deliverables(),x.acceptanceCriteria(),replace(x.ownerId(),from,to),replace(x.verifierId(),from,to),x.stageId(),x.startsOn(),x.endsOn(),x.resourceNotes(),x.itemIds(),x.milestoneIds()),null,null));}
        return content;
    }
    static ResourceRequest move(ResourceRequest x,UUID from,UUID to,LocalDate today){return DeliveryRules.resource(new ResourceRequest(x.workPackageId(),replace(x.personId(),from,to),replace(x.committerId(),from,to),x.startsOn().isBefore(today)?today:x.startsOn(),x.endsOn(),x.dailyHours(),x.requestNote()));}
    static Finding move(Finding x,UUID from,UUID to){return DeliveryRules.finding(new Finding(x.title(),x.kind(),x.impactCategory(),x.riskLevel(),replace(x.ownerId(),from,to),replace(x.verifierId(),from,to),x.dueDate(),x.closingCriteria(),x.impactScope(),replace(x.escalationOwnerId(),from,to),x.escalationPath()));}
}
