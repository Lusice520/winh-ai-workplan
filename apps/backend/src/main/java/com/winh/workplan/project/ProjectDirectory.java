package com.winh.workplan.project;
import java.util.List;
import java.util.UUID;
import com.winh.workplan.iam.authorization.ResourceContext;
import com.winh.workplan.iam.identity.SessionPrincipal;

public interface ProjectDirectory {
    ProjectContext requireReadable(SessionPrincipal actor, UUID projectId, String permission);
    ProjectContext requireWritable(SessionPrincipal actor, UUID projectId, String permission);
    List<ProjectContext> visible(SessionPrincipal actor, String permission);
    boolean participant(UUID projectId, UUID accountId);
    void activate(UUID projectId);
    /** Trusted synchronous transition, called only after the DG-02 approval transaction validates its snapshot. */
    void activateDelivery(UUID projectId, UUID approvedBy, UUID baselineId);
    MemberRoles memberRoles(SessionPrincipal actor,UUID projectId,UUID accountId);
    void validateRoleChanges(SessionPrincipal actor,UUID projectId,List<RoleChange> changes);
    void applyRoleChanges(SessionPrincipal actor,UUID projectId,List<RoleChange> changes,String reason);
    record MemberRoles(UUID accountId,long version,List<String> roleCodes,boolean originalOwner) {}
    record RoleChange(UUID accountId,long expectedVersion,List<String> roleCodes) {}
    record ProjectContext(UUID id, String code, String name, UUID salesOwnerId, UUID presalesOwnerId,
        String status, String mainStage, ResourceContext authorization, UUID opportunityId, UUID customerId, String customerName) {}
    record ProjectCreated(UUID id, UUID salesOwnerId, UUID presalesOwnerId, UUID actorId) {}
    record MemberRemovalRequested(UUID projectId, UUID accountId) {}
}
