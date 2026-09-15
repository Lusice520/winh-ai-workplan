package com.winh.workplan.delivery;

import com.winh.workplan.delivery.baseline.DeliveryContent.Content;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.List;
import java.util.UUID;

/** Current approved non-financial scope. Execution never owns or copies baseline objects. */
public interface ApprovedDeliveryDirectory {
    Scope require(SessionPrincipal actor, UUID projectId);
    record ObjectReference(UUID id,long version,String kind,Content content,boolean archived,int baselineVersion) {}
    record Scope(UUID projectId,UUID managerId,int baselineVersion,List<ObjectReference> objects) {}
    /** Synchronous event inside the project-locked approval transaction; listeners may reject unsafe changes. */
    record BaselineApplied(UUID projectId,List<ObjectReference> changed,int baselineVersion,UUID actorId) {}
}
