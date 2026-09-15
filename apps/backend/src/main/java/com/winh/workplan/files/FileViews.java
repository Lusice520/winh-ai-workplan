package com.winh.workplan.files;
import com.winh.workplan.business.BusinessHistory.EventView;
import java.time.Instant;
import java.util.*;
public final class FileViews {
    private FileViews() {}
    public record DocumentView(UUID id, long version, UUID projectId, String title, String kind, String mainStage,
        String classification, UUID currentVersionId, VersionView latestVersion, Instant updatedAt) {}
    public record VersionView(UUID id, long version, int versionNumber, String filename, long sizeBytes, String sha256,
        String status, String changeNote, UUID uploadedBy, String uploaderName, String reviewerName,
        Instant createdAt, Instant reviewedAt, String reviewComment) {}
    public record Detail(DocumentView document, List<VersionView> versions, List<EventView> history, List<String> allowedActions) {}
    public record Workspace(List<DocumentView> items, boolean storageConfigured, long maxBytes, List<String> allowedActions) {}
    public record Download(String filename, byte[] content) {}
}
