package com.winh.workplan.work;
import java.time.LocalDate;
import java.util.UUID;
import com.winh.workplan.iam.identity.SessionPrincipal;
public interface WorkDirectory {
    WorkReference create(SessionPrincipal actor,UUID projectId,UUID requirementId,String kind,String title,
        String description,UUID owner,UUID verifier,LocalDate dueDate);
    WorkReference require(SessionPrincipal actor,UUID projectId,UUID id);
    java.util.List<WorkReference> list(SessionPrincipal actor,UUID projectId,String kind);
    WorkReference registerDeliveryPackage(SessionPrincipal actor, UUID projectId, UUID existingId, String title,
        String scope, UUID ownerId, UUID verifierId, LocalDate dueDate);
    void setDeliveryState(UUID projectId, java.util.List<UUID> ids, String state, int baselineVersion);
    void reviseDeliveryPackage(UUID projectId, UUID id, String title, String scope, UUID ownerId, UUID verifierId, LocalDate dueDate, UUID actorId);
    WorkReference approveDeliveryPackage(UUID projectId,UUID reservedId,Long expectedWorkVersion,String title,String scope,
        UUID ownerId,UUID verifierId,LocalDate dueDate,UUID actorId,int baselineVersion);
    java.util.Set<UUID> completedPackageIds(UUID projectId);
    record BeforeExecutionAction(SessionPrincipal actor,WorkReference work,String action) {}
    record ExecutionAvailability(SessionPrincipal actor,WorkReference work,java.util.function.Consumer<String> disallow) {}
    record TaskResponsibilityTransferred(SessionPrincipal actor,WorkReference before,WorkReference after,String reason) {}
    record CompletionEligibility(SessionPrincipal actor,WorkReference work,java.util.function.Consumer<String> unavailable) {}
    record WorkReference(UUID id,UUID projectId,String kind,String title,String status,boolean approved,
        long version,UUID sourceRequirementId,String creationSource,UUID ownerId,UUID verifierId,LocalDate dueDate,
        String deliveryState,int deliveryBaselineVersion){}
}
