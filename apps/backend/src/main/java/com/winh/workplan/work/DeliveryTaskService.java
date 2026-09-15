package com.winh.workplan.work;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.work.DeliveryTaskCommands.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
class DeliveryTaskService {
    private final DeliveryTaskStore s;
    DeliveryTaskService(DeliveryTaskStore s){this.s=s;}
    UUID create(SessionPrincipal actor,UUID projectId,UUID parentId,Plan input){
        var c=s.context(actor,projectId,parentId,"WORK_EDIT");s.requirePlanner(actor,c);
        var reservation=s.access.reserve(actor,"delivery-task.create:"+parentId,input.requestId(),input);
        if(reservation.replayed())return reservation.targetId();
        s.active(c);s.openParent(c);parentVersion(c,input.parentVersion());
        ProjectWorkItem w;Object before=null;
        if(input.existingTaskId()!=null){
            w=s.task(projectId,input.existingTaskId());
            if(input.sourceVersion()==null)throw invalid("sourceVersion","接纳原任务需要当前版本。");version(w,input.sourceVersion());
            if(!"OPEN".equals(w.status)||s.profiles.existsById(w.id))throw conflict("仅尚未纳入工作包的未完成任务可以接纳。");
            before=s.snapshot(w,null);
        }else{
            w=new ProjectWorkItem();w.projectId=projectId;w.kind="TASK";w.creationSource="DELIVERY_TASK";w.createdBy=actor.accountId();
        }
        var p=new DeliveryTaskProfile();p.id=w.id;p.projectId=projectId;p.workPackageId=parentId;
        applyPlan(c,w,p,input,false);s.work.saveAndFlush(w);s.profiles.saveAndFlush(p);
        s.record(actor,w,p,input.existingTaskId()==null?"CREATE":"ADOPT",input.reason(),before);s.access.complete(reservation,w.id);return w.id;
    }
    void edit(SessionPrincipal actor,UUID projectId,UUID id,Plan input){
        var p=s.profile(projectId,id);var c=s.context(actor,projectId,p.workPackageId,"WORK_EDIT");s.requirePlanner(actor,c);
        var reservation=s.access.reserve(actor,"delivery-task.edit:"+id,input.requestId(),input);if(reservation.replayed())return;
        var w=s.task(projectId,id);s.versions(w,p,input.workVersion(),input.version());s.active(c);s.openParent(c);parentVersion(c,input.parentVersion());
        if(!"OPEN".equals(w.status))throw conflict("请先退回或明确重开任务，再修订当前计划。");
        Object before=s.snapshot(w,p);applyPlan(c,w,p,input,true);persist(actor,w,p,"EDIT",input.reason(),before);s.access.complete(reservation,id);
    }
    void act(SessionPrincipal actor,UUID projectId,UUID id,Action input){
        String action=choice(input.action(),"action","PROGRESS","COMPLETE","VERIFY","RETURN","CANCEL","REOPEN");
        var p=s.profile(projectId,id);var c=s.context(actor,projectId,p.workPackageId,Set.of("VERIFY","RETURN").contains(action)?"WORK_REVIEW":"WORK_EDIT");
        var reservation=s.access.reserve(actor,"delivery-task.act:"+id,input.requestId(),input);if(reservation.replayed())return;
        var w=s.task(projectId,id);s.versions(w,p,input.workVersion(),input.version());s.openParent(c);
        String note=required(input.note(),"note",4000);Object before=s.snapshot(w,p);
        switch(action){
            case "PROGRESS","COMPLETE" -> {
                if(!actor.accountId().equals(w.ownerAccountId))throw conflict("只有当前任务负责人可以提交自己的实际进展与成果。");
                if(!"OPEN".equals(w.status))throw conflict("当前任务不在可提交进展的状态。");
                if(s.needsReview(c,w,p))throw conflict("父范围已变化，请先明确复核当前任务计划。");
                s.actual(c,p,input.occurredOn());
                if(p.actualStartedOn==null)p.actualStartedOn=input.occurredOn();p.lastActualOn=input.occurredOn();
                if("PROGRESS".equals(action)){
                    if(input.progress()==null||input.progress()<0||input.progress()>99)throw invalid("progress","请填写 0–99，完成须提交独立验证。");
                    p.progress=input.progress();
                }else{
                    s.checkPeople(c,w.ownerAccountId,w.verifierAccountId);
                    p.filesJson=s.json(s.validateFiles(actor,projectId,input.fileVersionIds()));p.progress=100;p.actualCompletedOn=input.occurredOn();
                    w.status="PENDING_VERIFICATION";w.evidence=note;w.completedBy=actor.accountId();w.verifiedBy=null;w.verifiedAt=null;
                }
            }
            case "VERIFY","RETURN" -> {
                if(!"PENDING_VERIFICATION".equals(w.status))throw conflict("当前任务没有待核验的完成提交。");
                s.independent(actor,c,w);
                if("VERIFY".equals(action)){
                    if(s.needsReview(c,w,p))throw conflict("父范围已变化，当前提交须先退回并复核计划。");
                    s.validateFiles(actor,projectId,s.ids(p.filesJson));w.status="DONE";w.verifiedBy=actor.accountId();w.verifiedAt=Instant.now();
                }else{w.status="OPEN";p.progress=Math.min(p.progress,99);p.actualCompletedOn=null;}
            }
            case "CANCEL" -> {
                s.requirePlanner(actor,c);s.active(c);if(!"OPEN".equals(w.status))throw conflict("仅尚未提交完成的任务可以取消。");
                w.status="CANCELLED";
            }
            case "REOPEN" -> {
                s.requirePlanner(actor,c);s.active(c);if(!Set.of("DONE","CANCELLED").contains(w.status))throw conflict("仅已完成或已取消任务可以明确重开。");
                w.status="OPEN";w.evidence=null;w.completedBy=null;w.verifiedBy=null;w.verifiedAt=null;
                p.progress=0;p.actualStartedOn=null;p.lastActualOn=null;p.actualCompletedOn=null;p.filesJson="[]";
            }
            default -> throw invalid("action","不支持此操作。");
        }
        persist(actor,w,p,action,note,before);s.access.complete(reservation,id);
    }
    private void applyPlan(DeliveryTaskStore.Context c,ProjectWorkItem w,DeliveryTaskProfile p,Plan input,boolean editing){
        s.checkPeople(c,input.ownerId(),input.verifierId());
        if(editing&&(!w.ownerAccountId.equals(input.ownerId())||!w.verifierAccountId.equals(input.verifierId())))throw conflict("责任人变化请使用项目责任交接，不能从计划中静默换任。");
        if(input.startsOn()==null||input.dueDate()==null||input.startsOn().isAfter(input.dueDate()))throw invalid("dueDate","计划开始不能晚于完成日期。");
        var parent=c.ref().content().workPackage();
        if(input.startsOn().isBefore(parent.startsOn())||input.dueDate().isAfter(parent.endsOn()))throw invalid("startsOn","任务计划须位于原工作包当前计划窗口内。");
        var days=input.estimatedDays();
        if(days!=null&&(days.signum()<=0||days.compareTo(new BigDecimal("9999999.5"))>0||days.remainder(new BigDecimal("0.5")).signum()!=0))throw invalid("estimatedDays","预计投入以 0.5 天为单位，须大于零；未知时可留空。");
        var ids=input.itemIds()==null?List.<UUID>of():input.itemIds();var allowed=s.items(c).stream().map(o->o.id()).collect(java.util.stream.Collectors.toSet());
        if(ids.size()>100||ids.stream().anyMatch(Objects::isNull)||ids.stream().distinct().count()!=ids.size()||!allowed.containsAll(ids))throw invalid("itemIds","请选择本工作包下的有效清单，最多 100 项且不能重复。");
        w.title=required(input.title(),"title",160);w.description=required(input.description(),"description",8000);
        w.ownerAccountId=input.ownerId();w.verifierAccountId=input.verifierId();w.dueDate=input.dueDate();
        p.stageId=parent.stageId();p.startsOn=input.startsOn();p.estimatedDays=days;p.acceptanceCriteria=required(input.acceptanceCriteria(),"acceptanceCriteria",4000);
        p.itemIdsJson=s.json(ids);p.scopeHash=s.scopeHash(c,p);p.baselineVersion=c.scope().baselineVersion();
    }
    private void parentVersion(DeliveryTaskStore.Context c,Long expected){if(expected==null||expected!=c.ref().version())throw conflict("原工作包版本已变化，请刷新后核对当前范围。");}
    private void persist(SessionPrincipal actor,ProjectWorkItem w,DeliveryTaskProfile p,String action,String note,Object before){
        w.touch();p.touch();s.work.flush();s.profiles.flush();s.record(actor,w,p,action,note,before);
    }
}
