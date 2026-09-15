package com.winh.workplan.handover;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.UUID;

public interface EarlyStartDirectory {
    ApprovalReference requireEffective(SessionPrincipal actor, UUID projectId, UUID id);
    void regularize(SessionPrincipal actor, UUID projectId, UUID id, UUID packageId, EarlyStartCommands.Finish input);
    record ApprovalReference(UUID id, long version, String title, String startsOn, String endsOn) {}
}
