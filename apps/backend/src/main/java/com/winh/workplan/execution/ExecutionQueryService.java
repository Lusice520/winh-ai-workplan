package com.winh.workplan.execution;
import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.execution.ExecutionViews.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory.ObjectReference;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
class ExecutionQueryService {
    private final ExecutionStore s;
    ExecutionQueryService(ExecutionStore s){this.s=s;}
    Workspace workspace(SessionPrincipal actor,UUID projectId){
        var c=s.read(actor,projectId);
        return new Workspace(projectId,c.project().name(),c.project().status(),c.scope().managerId(),c.scope().baselineVersion(),c.scope().objects(),
            s.objects(c,"STAGE").stream().map(o->stage(actor,c,o)).toList(),s.objects(c,"ITEM").stream().map(o->item(actor,c,o)).toList(),
            s.objects(c,"MILESTONE").stream().map(o->milestone(actor,c,o)).toList(),s.events.findTop100ByProjectIdOrderByCreatedAtDesc(projectId).stream().map(e->event(actor,e)).toList(),
            s.items.findAllByProjectIdOrderByCreatedAtDesc(projectId).stream().filter(e->"PENDING".equals(e.status)&&actor.accountId().equals(e.verifierId))
                .map(e->itemEvent(actor,c,s.object(c,e.itemId,"ITEM"),e)).filter(e->e.allowedActions().contains("RETURN")).toList(),
            !"CLOSED".equals(c.project().status())?s.access.actions(actor,c.project().authorization(),"DELIVERY_EXECUTION_EDIT","DELIVERY_EXECUTION_REVIEW","DELIVERY_EXECUTION_MANAGE"):List.of());
    }
    ItemDetail itemDetail(SessionPrincipal actor,UUID projectId,UUID id){
        var c=s.read(actor,projectId);var ref=s.object(c,id,"ITEM");
        return new ItemDetail(ref,item(actor,c,ref),s.itemRows(c,id).stream().map(e->itemEvent(actor,c,ref,e)).toList(),history(actor,projectId,id));
    }
    List<Event> history(SessionPrincipal actor,UUID projectId,UUID id){
        var c=s.read(actor,projectId);if(c.scope().objects().stream().noneMatch(o->o.id().equals(id)))throw missing();
        return s.events.findAllByProjectIdAndObjectIdOrderByCreatedAtDesc(projectId,id).stream().map(e->event(actor,e)).toList();
    }
    private Stage stage(SessionPrincipal actor,ExecutionStore.Context c,ObjectReference ref){
        var row=s.stages.findByProjectIdAndStageId(c.project().id(),ref.id()).orElse(null);var status=s.stageStatus(c,row,ref);var actions=new ArrayList<String>();
        boolean running=s.activeProject(c)&&s.projects.participant(c.project().id(),actor.accountId());
        if(running&&!"SKIPPED".equals(status)){
            if(actor.accountId().equals(c.scope().managerId())&&s.allows(actor,c,"DELIVERY_EXECUTION_MANAGE"))switch(status){
                case "NOT_STARTED" -> actions.add("START");case "IN_PROGRESS" -> actions.addAll(List.of("PAUSE","COMPLETE"));
                case "PAUSED" -> actions.add("RESUME");case "COMPLETED","NEEDS_REVIEW" -> actions.add("REOPEN");default -> {}
            }
            if("IN_PROGRESS".equals(status)&&s.responsible(actor,c,ref)&&s.allows(actor,c,"DELIVERY_EXECUTION_EDIT"))actions.addFirst("PROGRESS");
        }
        List<String> blockers="SKIPPED".equals(status)?List.of():"NOT_STARTED".equals(status)?s.predecessorProblems(c,ref):s.stageCompletionProblems(c,ref);
        return new Stage(ref.id(),row==null?-1:row.version,status,row==null?0:row.progress,row==null?null:row.startedOn,row==null?null:row.completedOn,blockers,List.copyOf(actions));
    }
    private Item item(SessionPrincipal actor,ExecutionStore.Context c,ObjectReference ref){
        var p=s.profiles.findByProjectIdAndItemId(c.project().id(),ref.id()).orElse(null);var actions=new ArrayList<String>();
        if(s.activeProject(c)&&s.projects.participant(c.project().id(),actor.accountId())){
            if(actor.accountId().equals(c.scope().managerId())&&s.allows(actor,c,"DELIVERY_EXECUTION_MANAGE"))actions.add("PROFILE");
            if(p!=null&&s.responsible(actor,c,ref)&&s.allows(actor,c,"DELIVERY_EXECUTION_EDIT")&&stageRunning(c,ref)){
                if(p.requiresReceipt)actions.add("RECEIVED");if(p.requiresInstallation)actions.add("INSTALLED");actions.add("ACCEPTED");
            }
        }
        return new Item(ref.id(),p==null?null:new Profile(p.version,p.requiresReceipt,p.requiresInstallation,p.brand,p.model,p.supplier),
            s.rules.totals(s.itemRows(c,ref.id()),s.rules.scopeHash(ref)),List.copyOf(actions));
    }
    private ItemEvent itemEvent(SessionPrincipal actor,ExecutionStore.Context c,ObjectReference ref,ExecutionItemEvent row){
        var files=s.fileProjection(actor,c.project().id(),row.filesJson);var actions=new ArrayList<String>();
        boolean writable=!"CLOSED".equals(c.project().status())&&s.projects.participant(c.project().id(),actor.accountId());
        boolean reviewer=actor.accountId().equals(row.verifierId)&&!actor.accountId().equals(row.submittedBy)&&!actor.accountId().equals(s.owner(c,ref))&&s.allows(actor,c,"DELIVERY_EXECUTION_REVIEW");
        if(writable){
            if("PENDING".equals(row.status)&&reviewer){if(row.scopeHash.equals(s.rules.scopeHash(ref)))actions.add("VERIFY");actions.add("RETURN");}
            if(!"REVERSAL".equals(row.kind)&&Set.of("RECORDED","VERIFIED").contains(row.status)){
                if("ACCEPTED".equals(row.kind)?reviewer:s.allows(actor,c,"DELIVERY_EXECUTION_EDIT")&&(actor.accountId().equals(row.submittedBy)||actor.accountId().equals(c.scope().managerId())))actions.add("REVERSE");
            }
        }
        return new ItemEvent(row.id,row.version,row.itemId,row.kind,s.itemStatus(row,ref),row.quantity,row.occurredOn,row.evidence,files.files(),files.restricted(),
            row.submittedBy,s.access.name(row.submittedBy),row.verifierId,s.access.name(row.verifierId),row.decidedBy,s.access.name(row.decidedBy),row.decidedAt,row.decision,row.reversalOfId,
            row.objectVersion,row.baselineVersion,row.createdAt,List.copyOf(actions));
    }
    private Milestone milestone(SessionPrincipal actor,ExecutionStore.Context c,ObjectReference ref){
        var row=s.milestones.findByProjectIdAndMilestoneId(c.project().id(),ref.id()).orElse(null);var actions=new ArrayList<String>();
        String status=s.milestoneStatus(c,row,ref);var files=row==null?new FileProjection(List.of(),0):s.fileProjection(actor,c.project().id(),row.filesJson);
        if(!"CLOSED".equals(c.project().status())&&s.projects.participant(c.project().id(),actor.accountId())){
            if("OPEN".equals(status)&&s.activeProject(c)&&stageRunning(c,ref)&&s.responsible(actor,c,ref)&&s.allows(actor,c,"DELIVERY_EXECUTION_EDIT"))actions.add("SUBMIT");
            if(row!=null&&"PENDING".equals(row.status)&&actor.accountId().equals(row.verifierId)&&!actor.accountId().equals(row.submittedBy)&&!actor.accountId().equals(s.owner(c,ref))&&s.allows(actor,c,"DELIVERY_EXECUTION_REVIEW")){
                if("PENDING".equals(status))actions.add("VERIFY");actions.add("RETURN");
            }
            if(row!=null&&"VERIFIED".equals(row.status)&&actor.accountId().equals(c.scope().managerId())&&s.allows(actor,c,"DELIVERY_EXECUTION_MANAGE"))actions.add("REOPEN");
        }
        return new Milestone(ref.id(),row==null?-1:row.version,status,row==null?null:row.occurredOn,row==null?null:row.evidence,files.files(),files.restricted(),
            row==null?null:row.submittedBy,row==null?null:s.access.name(row.submittedBy),row==null?null:row.verifierId,row==null?null:s.access.name(row.verifierId),
            row==null?null:row.decidedBy,row==null?null:s.access.name(row.decidedBy),row==null?null:row.decidedAt,row==null?null:row.decision,s.milestoneProblems(c,ref),List.copyOf(actions));
    }
    private boolean stageRunning(ExecutionStore.Context c,ObjectReference ref){return s.stages.findByProjectIdAndStageId(c.project().id(),s.stageId(ref)).map(row->"IN_PROGRESS".equals(row.status)).orElse(false);}
    private Event event(SessionPrincipal actor,ExecutionEvent e){
        var before=s.visibleSnapshot(actor,e.projectId,e.beforeJson);var after=s.visibleSnapshot(actor,e.projectId,e.afterJson);
        return new Event(e.id,e.objectId,e.kind,e.action,e.note,e.actorId,s.access.name(e.actorId),e.occurredOn,before.json(),after.json(),before.files(),after.files(),e.objectVersion,e.baselineVersion,e.createdAt);
    }
}
