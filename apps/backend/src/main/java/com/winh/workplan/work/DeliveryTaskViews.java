package com.winh.workplan.work;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory.ObjectReference;
import com.winh.workplan.execution.ExecutionDirectory.StageState;
import com.winh.workplan.files.FileDirectory.VersionReference;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
final class DeliveryTaskViews {
    private DeliveryTaskViews(){}
    record Row(UUID id,long version,long workVersion,String title,String acceptanceCriteria,String status,boolean needsReview,
        UUID sourceRequirementId,UUID ownerId,String ownerName,UUID verifierId,String verifierName,
        LocalDate startsOn,LocalDate dueDate,BigDecimal estimatedDays,int progress,LocalDate actualStartedOn,
        LocalDate actualCompletedOn,int itemCount,List<String> allowedActions){}
    record Workspace(UUID projectId,String projectName,ObjectReference workPackage,String packageStatus,StageState stage,
        List<ObjectReference> items,List<Row> tasks,List<WorkDirectory.WorkReference> availableTasks,List<Event> recentEvents,List<String> allowedActions){}
    record Files(List<VersionReference> files,int restricted){}
    record Snapshot(String json,Files files){}
    record Event(UUID id,UUID taskId,String action,String note,UUID actorId,String actorName,Instant at,Snapshot before,Snapshot after){}
    record Detail(UUID projectId,String projectName,ObjectReference workPackage,String packageStatus,StageState stage,
        Row task,String description,String acceptanceCriteria,List<UUID> itemIds,List<ObjectReference> items,
        String evidence,UUID submittedBy,String submitterName,UUID verifiedBy,String verifierName,Instant verifiedAt,
        int baselineVersion,Files files,List<Event> history){}
}
