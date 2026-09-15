package com.winh.workplan.crm;

import java.util.UUID;
import com.winh.workplan.iam.identity.SessionPrincipal;

/** Immutable cross-module facts. Authorization belongs to the calling business operation. */
public interface CrmDirectory {
    OpportunityReference reference(UUID id);
    boolean canReadCustomer(SessionPrincipal actor, UUID id);
    boolean canReadOpportunity(SessionPrincipal actor, UUID id);
    OpportunityReference lockForProject(SessionPrincipal actor, UUID id);
    void bindProject(UUID opportunityId, UUID projectId);
    record OpportunityReference(UUID id, UUID customerId, String customerName, String title,
        UUID ownerAccountId, UUID organizationUnitId, String background, String procurementMethod,
        String status, String result, UUID projectId) {}
    record OpportunityResultChanged(UUID opportunityId, UUID projectId, String status, String result, UUID actorId) {}
}
