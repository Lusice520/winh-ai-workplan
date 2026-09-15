package com.winh.workplan.execution;

import static com.winh.workplan.business.BusinessRules.*;
import com.winh.workplan.business.*;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory.*;
import com.winh.workplan.files.FileDirectory;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.project.ProjectDirectory;
import com.winh.workplan.work.WorkDirectory;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Component;

/** Commands/read services own transactions; this shared collaborator is deliberately not proxied. */
@Component
class ExecutionStore {
    final ExecutionStageRepository stages; final ExecutionProfileRepository profiles;
    final ExecutionItemEventRepository items; final ExecutionMilestoneRepository milestones; final ExecutionEventRepository events;
    final ProjectDirectory projects; final BusinessAccess access; final BusinessHistory history; final ApprovedDeliveryDirectory delivery;
    final WorkDirectory work; final FileDirectory files; final ExecutionRules rules;
    ExecutionStore(ExecutionStageRepository stages,ExecutionProfileRepository profiles,ExecutionItemEventRepository items,
            ExecutionMilestoneRepository milestones,ExecutionEventRepository events,ProjectDirectory projects,
            BusinessAccess access,BusinessHistory history,ApprovedDeliveryDirectory delivery,WorkDirectory work,FileDirectory files,ExecutionRules rules){
        this.stages=stages;this.profiles=profiles;this.items=items;this.milestones=milestones;this.events=events;this.projects=projects;
        this.access=access;this.history=history;this.delivery=delivery;this.work=work;this.files=files;this.rules=rules;
    }
    Context read(SessionPrincipal actor,UUID projectId){
        var p=projects.requireReadable(actor,projectId,"DELIVERY_EXECUTION_READ");return new Context(p,delivery.require(actor,projectId));
    }
    Context write(SessionPrincipal actor,UUID projectId,String permission){
        var p=projects.requireWritable(actor,projectId,permission);
        if(!projects.participant(projectId,actor.accountId()))throw conflict("请由参与本项目的当前责任人操作。");
        access.require(actor,"DELIVERY_EXECUTION_READ",p.authorization());return new Context(p,delivery.require(actor,projectId));
    }
    boolean allows(SessionPrincipal actor,Context c,String permission){return access.allows(actor,permission,c.project.authorization());}
    boolean activeProject(Context c){return "ACTIVE".equals(c.project.status());}
    void runningProject(Context c){if(!activeProject(c))throw conflict("项目当前未在执行中，请先恢复项目后登记新的实际。");}
    ObjectReference object(Context c,UUID id,String kind){return c.scope.objects().stream()
        .filter(o->o.id().equals(id)&&o.kind().equals(kind)&&!o.archived()).findFirst().orElseThrow(BusinessRules::missing);}
    List<ObjectReference> objects(Context c,String kind){return c.scope.objects().stream().filter(o->o.kind().equals(kind)&&!o.archived()).toList();}
    void manager(SessionPrincipal actor,Context c){if(!c.scope.managerId().equals(actor.accountId()))throw conflict("此操作须由当前实际项目经理办理。");}
    UUID owner(Context c,ObjectReference o){return switch(o.kind()){
        case "STAGE" -> o.content().stage().ownerId();case "MILESTONE" -> o.content().milestone().ownerId();
        case "WORK_PACKAGE" -> o.content().workPackage().ownerId();case "ITEM" -> object(c,o.content().item().workPackageId(),"WORK_PACKAGE").content().workPackage().ownerId();default -> null;};}
    UUID stageId(ObjectReference o){return switch(o.kind()){
        case "STAGE" -> o.id();case "MILESTONE" -> o.content().milestone().stageId();case "WORK_PACKAGE" -> o.content().workPackage().stageId();case "ITEM" -> o.content().item().stageId();default -> null;};}
    boolean responsible(SessionPrincipal actor,Context c,ObjectReference o){return actor.accountId().equals(c.scope.managerId())||actor.accountId().equals(owner(c,o))||
        ("ITEM".equals(o.kind())&&actor.accountId().equals(object(c,stageId(o),"STAGE").content().stage().ownerId()));}
    void requireResponsible(SessionPrincipal actor,Context c,ObjectReference o){if(!responsible(actor,c,o))throw conflict("请由项目经理或本范围实际负责人登记执行。");}
    void runningStage(Context c,ObjectReference o){
        var ref=object(c,stageId(o),"STAGE");var row=stages.findByProjectIdAndStageId(c.project.id(),ref.id()).orElse(null);
        if(!Boolean.TRUE.equals(ref.content().stage().applicable())||row==null||!"IN_PROGRESS".equals(row.status))throw conflict("当前阶段尚未开始、已暂停或已完成，请先由项目经理处理阶段状态。");
    }
    void occurredDuringStage(Context c,ObjectReference o,LocalDate date){
        runningStage(c,o);var stage=stages.findByProjectIdAndStageId(c.project.id(),stageId(o)).orElseThrow();
        if(date.isBefore(stage.startedOn))throw invalid("occurredOn","实际日期不能早于本阶段记录的开始日期。");
    }
    String completionScopeHash(Context c,ObjectReference ref){
        var dependencies=new TreeMap<String,String>();
        for(var o:c.scope.objects()){
            if(o.archived()||o.id().equals(ref.id()))continue;
            boolean included="STAGE".equals(ref.kind())?ref.id().equals(stageId(o)):
                ("ITEM".equals(o.kind())&&ref.id().equals(o.content().item().milestoneId()))||
                ("WORK_PACKAGE".equals(o.kind())&&o.content().workPackage().milestoneIds().contains(ref.id()));
            if(!included)continue;
            if("WORK_PACKAGE".equals(o.kind())){
                var w=o.content().workPackage();dependencies.put(o.id().toString(),rules.hash(Arrays.asList(w.scope(),w.deliverables(),w.acceptanceCriteria(),w.itemIds(),w.milestoneIds())));
            }else dependencies.put(o.id().toString(),rules.scopeHash(o));
        }
        return rules.hash(List.of(rules.scopeHash(ref),dependencies));
    }
    String stageStatus(Context c,ExecutionStage row,ObjectReference ref){
        if(!Boolean.TRUE.equals(ref.content().stage().applicable()))return "SKIPPED";
        if(row==null)return "NOT_STARTED";
        return "COMPLETED".equals(row.status)&&(!row.scopeHash.equals(completionScopeHash(c,ref))||!stageCompletionProblems(c,ref).isEmpty())?"NEEDS_REVIEW":row.status;
    }
    String milestoneStatus(Context c,ExecutionMilestone row,ObjectReference ref){
        if(row==null)return "OPEN";
        return !"OPEN".equals(row.status)&&(!row.scopeHash.equals(completionScopeHash(c,ref))||!milestoneProblems(c,ref).isEmpty())?"NEEDS_REVIEW":row.status;
    }
    String itemStatus(ExecutionItemEvent row,ObjectReference ref){
        return "ACCEPTED".equals(row.kind)&&Set.of("PENDING","VERIFIED").contains(row.status)&&!row.scopeHash.equals(rules.scopeHash(ref))?"NEEDS_REVIEW":row.status;
    }
    List<String> predecessorProblems(Context c,ObjectReference stage){
        var problems=new ArrayList<String>();
        for(UUID id:stage.content().stage().predecessorIds()){
            var predecessor=object(c,id,"STAGE");var row=stages.findByProjectIdAndStageId(c.project.id(),id).orElse(null);
            if(!"COMPLETED".equals(stageStatus(c,row,predecessor)))problems.add("前置阶段尚未完成："+predecessor.content().title());
        }
        return problems;
    }
    List<String> milestoneProblems(Context c,ObjectReference milestone){
        var result=new ArrayList<String>();var done=work.completedPackageIds(c.project.id());
        for(var w:objects(c,"WORK_PACKAGE"))if(w.content().workPackage().milestoneIds().contains(milestone.id())&&!done.contains(w.id()))result.add("工作包未独立完成："+w.content().title());
        for(var item:objects(c,"ITEM"))if(milestone.id().equals(item.content().item().milestoneId()))itemCompletionProblem(c,item,result);
        return result;
    }
    List<String> stageCompletionProblems(Context c,ObjectReference stage){
        var result=new ArrayList<>(predecessorProblems(c,stage));var done=work.completedPackageIds(c.project.id());
        for(var w:objects(c,"WORK_PACKAGE"))if(stage.id().equals(stageId(w))&&!done.contains(w.id()))result.add("工作包未独立完成："+w.content().title());
        for(var item:objects(c,"ITEM"))if(stage.id().equals(stageId(item)))itemCompletionProblem(c,item,result);
        for(var m:objects(c,"MILESTONE"))if(stage.id().equals(stageId(m))&&!"VERIFIED".equals(milestoneStatus(c,milestones.findByProjectIdAndMilestoneId(c.project.id(),m.id()).orElse(null),m)))result.add("里程碑未验证："+m.content().title());
        return result;
    }
    void itemCompletionProblem(Context c,ObjectReference item,List<String> problems){
        var totals=rules.totals(itemRows(c,item.id()),rules.scopeHash(item));
        if(totals.accepted().compareTo(item.content().item().quantity())<0)problems.add("清单未全部验收："+item.content().title());
    }
    List<ExecutionItemEvent> itemRows(Context c,UUID id){return items.findAllByProjectIdAndItemIdOrderByCreatedAtDesc(c.project.id(),id);}
    void checkReviewer(Context c,UUID candidate,UUID submitter,UUID owner){
        if(candidate==null||candidate.equals(submitter)||candidate.equals(owner))throw invalid("verifierId","请选择与提交人及当前负责人不同的独立验证人。");
        var person=access.account(candidate);if(!projects.participant(c.project.id(),candidate))throw invalid("verifierId","验证人须为当前有效项目成员。");
        var principal=new SessionPrincipal(candidate,person.loginName(),person.displayName(),false,false,new UUID(0,0));
        if(!allows(principal,c,"DELIVERY_EXECUTION_READ")||!allows(principal,c,"DELIVERY_EXECUTION_REVIEW")||!allows(principal,c,"DG2_READ"))throw invalid("verifierId","所选人员缺少本项目执行读取或独立核验权限。");
    }
    void independent(SessionPrincipal actor,Context c,UUID verifier,UUID submitter,UUID owner){
        checkReviewer(c,verifier,submitter,owner);if(!actor.accountId().equals(verifier))throw conflict("只有当前指定的其他验证人可以确认。");
    }
    List<UUID> validateFiles(SessionPrincipal actor,UUID projectId,List<UUID> ids){
        if(ids==null)return List.of();if(ids.size()>20||ids.stream().anyMatch(Objects::isNull)||ids.stream().distinct().count()!=ids.size())throw invalid("fileVersionIds","附件最多 20 个，不能重复或为空。");
        ids.forEach(id->files.requirePublished(actor,projectId,id,null));return List.copyOf(ids);
    }
    List<UUID> fileIds(String json){return Arrays.asList(rules.read(json,UUID[].class));}
    ExecutionViews.FileProjection fileProjection(SessionPrincipal actor,UUID projectId,String json){
        var visible=new ArrayList<FileDirectory.VersionReference>();int restricted=0;
        for(UUID id:fileIds(json))try{visible.add(files.reference(actor,projectId,id));}catch(DomainException e){restricted++;}
        return new ExecutionViews.FileProjection(visible,restricted);
    }
    void record(Context c,ObjectReference object,String action,String note,LocalDate date,UUID actor,Object before,Object after){
        var e=new ExecutionEvent();e.projectId=c.project.id();e.objectId=object.id();e.kind=object.kind();e.action=action;
        e.note=required(note,"note",4000);e.occurredOn=date;e.actorId=actor;e.beforeJson=rules.json(before);e.afterJson=rules.json(after);
        e.objectVersion=object.version();e.baselineVersion=c.scope.baselineVersion();events.saveAndFlush(e);
        history.record(object.id(),"PROJECT_EXECUTION","EXECUTION_"+action,"记录原批准范围下的执行事实。",actor);
    }
    Object stageSnapshot(ExecutionStage s){return s==null?null:new StageSnapshot(s.status,s.progress,s.startedOn,s.completedOn,s.scopeHash);}
    Object profileSnapshot(ExecutionItemProfile p){return p==null?null:new ProfileSnapshot(p.requiresReceipt,p.requiresInstallation,p.brand,p.model,p.supplier);}
    Object milestoneSnapshot(ExecutionMilestone m){return m==null?null:new MilestoneSnapshot(m.status,m.occurredOn,m.evidence,m.submittedBy,m.verifierId,m.decidedBy,m.decidedAt,m.decision,m.scopeHash,fileIds(m.filesJson));}
    Object itemSnapshot(ExecutionItemEvent e){return new ItemSnapshot(e.id,e.kind,e.status,e.quantity,e.occurredOn,e.evidence,e.submittedBy,e.verifierId,e.decidedBy,e.decidedAt,e.decision,e.reversalOfId,fileIds(e.filesJson));}
    ExecutionViews.HistorySnapshot visibleSnapshot(SessionPrincipal actor,UUID projectId,String json){
        var node=rules.read(json,com.fasterxml.jackson.databind.JsonNode.class);
        var projection=new ExecutionViews.FileProjection(List.of(),0);
        if(node instanceof com.fasterxml.jackson.databind.node.ObjectNode object){
            var ids=object.remove("fileVersionIds");
            if(ids!=null&&!ids.isNull())projection=fileProjection(actor,projectId,ids.toString());
        }
        return new ExecutionViews.HistorySnapshot(rules.json(node),projection);
    }
    record Context(ProjectDirectory.ProjectContext project,Scope scope){}
    private record StageSnapshot(String status,int progress,LocalDate startedOn,LocalDate completedOn,String scopeHash){}
    private record ProfileSnapshot(boolean requiresReceipt,boolean requiresInstallation,String brand,String model,String supplier){}
    private record MilestoneSnapshot(String status,LocalDate occurredOn,String evidence,UUID submittedBy,UUID verifierId,UUID decidedBy,Instant decidedAt,String decision,String scopeHash,List<UUID> fileVersionIds){}
    private record ItemSnapshot(UUID id,String kind,String status,java.math.BigDecimal quantity,LocalDate occurredOn,String evidence,UUID submittedBy,UUID verifierId,UUID decidedBy,Instant decidedAt,String decision,UUID reversalOfId,List<UUID> fileVersionIds){}
}
