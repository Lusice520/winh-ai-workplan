package com.winh.workplan.presales;

import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.UUID;

public interface PresalesDirectory {
    DeliverableReference reference(SessionPrincipal actor, UUID projectId, UUID id);
    record DeliverableReference(UUID id, UUID actionId, UUID projectId, long version, int versionNumber,
        String title, String kind, String status, boolean current) {}
}
