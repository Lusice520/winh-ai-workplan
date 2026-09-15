package com.winh.workplan.handover;
import com.winh.workplan.business.BusinessHistory.EventView;
import java.time.*;
import java.util.*;

public final class HandoverViews {
    private HandoverViews() {}
    public record Case(UUID id,long version,UUID projectId,String projectType,String templateVersion,String status,
        UUID receiverId,String receiverName,LocalDate dueDate,String basisKind,UUID basisReferenceId,String basisNote) {}
    public record Item(UUID id,long version,String key,String name,String groupKey,String applicability,boolean applicable,
        UUID ownerId,String ownerName,LocalDate dueDate,String referenceKind,UUID referenceId,String referenceTitle,
        String note,String status,String problem,boolean overdue) {}
    public record ReviewRound(UUID id,long version,String status,UUID submittedBy,String submittedByName,String submissionNote,
        String reviewedByName,Instant createdAt,Instant reviewedAt,String comment,String snapshotHash) {}
    public record Package(UUID id,String number,String snapshotHash,String approvedByName,Instant approvedAt,boolean current,String comment) {}
    public record Workspace(Case handover,List<Item> items,int requiredCount,int readyCount,int missingCount,
        List<ReviewRound> reviews,List<Package> packages,List<EventView> history,List<String> allowedActions) {}
    public record ItemFact(UUID id,String key,String name,String groupKey,String applicability,boolean applicable,
        UUID ownerId,LocalDate dueDate,String referenceKind,UUID referenceId,String note,String sourceStamp) {}
    public record Snapshot(UUID projectId,String projectCode,String projectName,String projectType,String templateVersion,
        UUID receiverId,LocalDate dueDate,String basisKind,UUID basisReferenceId,String basisNote,List<ItemFact> items) {}
    public record PackageDetail(Package handoverPackage,String projectCode,String projectName,String projectType,
        String templateVersion,String receiverName,LocalDate dueDate,String basisKind,String basisNote,List<Item> items) {}
}
