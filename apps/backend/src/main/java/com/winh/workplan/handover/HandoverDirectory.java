package com.winh.workplan.handover;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.UUID;

public interface HandoverDirectory {
    PackageReference requireCurrentPackage(SessionPrincipal actor, UUID projectId);
    java.util.Optional<PackageReference> approvedPackageSummary(SessionPrincipal actor, UUID projectId);
    record PackageReference(UUID id, UUID projectId, UUID receiverId, String number, String hash, String basisKind, String projectType) {}
}
