package com.winh.workplan.execution;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory.*;
import com.winh.workplan.files.FileDirectory.VersionReference;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
final class ExecutionViews {
    private ExecutionViews(){}
    record Stage(UUID id,long version,String status,int progress,LocalDate startedOn,LocalDate completedOn,
        List<String> blockers,List<String> allowedActions){}
    record Profile(long version,boolean requiresReceipt,boolean requiresInstallation,String brand,String model,String supplier){}
    record Item(UUID id,Profile profile,ExecutionRules.Totals totals,List<String> allowedActions){}
    record ItemEvent(UUID id,long version,UUID itemId,String kind,String status,BigDecimal quantity,LocalDate occurredOn,
        String evidence,List<VersionReference> files,int restrictedFileCount,UUID submittedBy,String submitterName,
        UUID verifierId,String verifierName,UUID decidedBy,String decisionName,Instant decidedAt,String decision,UUID reversalOfId,
        long objectVersion,int baselineVersion,Instant createdAt,List<String> allowedActions){}
    record Milestone(UUID id,long version,String status,LocalDate occurredOn,String evidence,List<VersionReference> files,
        int restrictedFileCount,UUID submittedBy,String submitterName,UUID verifierId,String verifierName,
        UUID decidedBy,String decisionName,Instant decidedAt,String decision,List<String> blockers,List<String> allowedActions){}
    record Event(UUID id,UUID objectId,String kind,String action,String note,UUID actorId,String actorName,LocalDate occurredOn,
        String beforeJson,String afterJson,FileProjection beforeFiles,FileProjection afterFiles,long objectVersion,int baselineVersion,Instant at){}
    record Workspace(UUID projectId,String projectName,String projectStatus,UUID managerId,int baselineVersion,
        List<ObjectReference> objects,List<Stage> stages,List<Item> items,List<Milestone> milestones,List<Event> recentEvents,
        List<ItemEvent> reviewQueue,List<String> allowedActions){}
    record ItemDetail(ObjectReference object,Item item,List<ItemEvent> events,List<Event> history){}
    record FileProjection(List<VersionReference> files,int restricted){}
    record HistorySnapshot(String json,FileProjection files){}
}
