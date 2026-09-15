package com.winh.workplan.files;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.UUID;

public interface FileDirectory {
    VersionReference reference(SessionPrincipal actor, UUID projectId, UUID versionId);
    VersionReference requirePublished(SessionPrincipal actor, UUID projectId, UUID versionId, String classification);
    record VersionReference(UUID documentId, UUID versionId, UUID projectId, String title, String filename,
        int versionNumber, String classification, String status, boolean current, long stateVersion, String sha256) {}
}
