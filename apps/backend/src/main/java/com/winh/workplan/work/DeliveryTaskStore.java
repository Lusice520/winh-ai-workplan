package com.winh.workplan.work;

import static com.winh.workplan.business.BusinessRules.*;
import com.fasterxml.jackson.databind.*;
import com.winh.workplan.business.*;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory;
import com.winh.workplan.delivery.ApprovedDeliveryDirectory.*;
import com.winh.workplan.execution.ExecutionDirectory;
import com.winh.workplan.files.FileDirectory;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.project.ProjectDirectory;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Component;

/** No proxy: command/query services own transactions and the project serialization lock. */
@Component
class DeliveryTaskStore {
    final WorkItemRepository work;final DeliveryTaskProfileRepository profiles;final DeliveryTaskEventRepository events;
    final ProjectDirectory projects;final BusinessAccess access;final BusinessHistory history;
    final ApprovedDeliveryDirectory delivery;final ExecutionDirectory execution;final FileDirectory files;final ObjectMapper mapper;
    DeliveryTaskStore(WorkItemRepository work,DeliveryTaskProfileRepository profiles,DeliveryTaskEventRepository events,
            ProjectDirectory projects,BusinessAccess access,BusinessHistory history,ApprovedDeliveryDirectory delivery,
            ExecutionDirectory execution,FileDirectory files,ObjectMapper mapper){
        this.work=work;this.profiles=profiles;this.events=events;this.projects=projects;this.access=access;this.history=history;
        this.delivery=delivery;this.execution=execution;this.files=files;this.mapper=mapper;
    }
    Context context(SessionPrincipal actor,UUID projectId,UUID parentId,String writePermission){
        var p=writePermission==null?projects.requireReadable(actor,projectId,"WORK_READ"):projects.requireWritable(actor,projectId,writePermission);
        if(writePermission!=null){access.require(actor,"WORK_READ",p.authorization());if(!projects.participant(projectId,actor.accountId()))throw conflict("请由本项目当前成员办理。");}
        var scope=delivery.require(actor,projectId);
        var ref=scope.objects().stream().filter(o->o.id().equals(parentId)&&"WORK_PACKAGE".equals(o.kind())).findFirst().orElseThrow(BusinessRules::missing);
        var parent=work.findById(parentId).filter(w->w.projectId.equals(projectId)&&"WORK_PACKAGE".equals(w.kind)).orElseThrow(BusinessRules::missing);
        return new Context(p,scope,ref,parent,execution.stage(actor,projectId,ref.content().workPackage().stageId()));
    }
    DeliveryTaskProfile profile(UUID projectId,UUID id){return profiles.findById(id).filter(p->p.projectId.equals(projectId)).orElseThrow(BusinessRules::missing);}
    ProjectWorkItem task(UUID projectId,UUID id){return work.findById(id).filter(w->w.projectId.equals(projectId)&&"TASK".equals(w.kind)).orElseThrow(BusinessRules::missing);}
    boolean planner(SessionPrincipal actor,Context c){return actor.accountId().equals(c.scope.managerId())||actor.accountId().equals(c.parent.ownerAccountId);}
    void requirePlanner(SessionPrincipal actor,Context c){if(!planner(actor,c))throw conflict("请由当前项目经理或本工作包负责人维护任务安排。");}
    void openParent(Context c){if(c.ref.archived()||!"BASELINED".equals(c.parent.deliveryState)||!"OPEN".equals(c.parent.status))throw conflict("原工作包须为已批准且尚未提交完成；当前不能改变下属任务。");}
    void active(Context c){if(!"ACTIVE".equals(c.project.status()))throw conflict("请先恢复项目，再维护计划或登记新的实际。");}
    void actual(Context c,DeliveryTaskProfile p,LocalDate date){
        active(c);if(!"IN_PROGRESS".equals(c.stage.status()))throw conflict("原阶段尚未开始、已暂停或已完成，请先处理阶段状态。");
        if(date==null||date.isAfter(today()))throw invalid("occurredOn","请填写已实际发生的日期，不能晚于今天。");
        if(c.stage.startedOn()==null||date.isBefore(c.stage.startedOn()))throw invalid("occurredOn","实际日期不能早于阶段实际开始日期。");
        if(p.lastActualOn!=null&&date.isBefore(p.lastActualOn))throw invalid("occurredOn","本轮实际日期不能早于已记录的进展日期。");
    }
    void checkPeople(Context c,UUID owner,UUID verifier){
        if(owner==null||verifier==null||owner.equals(verifier))throw invalid("verifierId","负责人和独立验证人必须不同。");
        for(UUID id:List.of(owner,verifier)){
            var account=access.account(id);if(!projects.participant(c.project.id(),id))throw invalid("ownerId","任务责任人须为本项目当前有效成员。");
            var actor=new SessionPrincipal(id,account.loginName(),account.displayName(),false,false,new UUID(0,0));
            if(!access.allows(actor,"WORK_READ",c.project.authorization())||!access.allows(actor,id.equals(owner)?"WORK_EDIT":"WORK_REVIEW",c.project.authorization())||
                !access.allows(actor,"DG2_READ",c.project.authorization())||!access.allows(actor,"DELIVERY_EXECUTION_READ",c.project.authorization()))
                throw invalid(id.equals(owner)?"ownerId":"verifierId","所选人员缺少任务或交付读取及相应处理权限。");
        }
    }
    void independent(SessionPrincipal actor,Context c,ProjectWorkItem w){
        if(!actor.accountId().equals(w.verifierAccountId)||actor.accountId().equals(w.ownerAccountId)||actor.accountId().equals(w.completedBy))throw conflict("请由指定的其他验证人独立确认，原提交人不能自行验证。");
    }
    List<ObjectReference> items(Context c){return c.scope.objects().stream().filter(o->!o.archived()&&"ITEM".equals(o.kind())&&c.ref.id().equals(o.content().item().workPackageId())).toList();}
    List<UUID> ids(String json){return Arrays.asList(read(json,UUID[].class));}
    String scopeHash(Context c,DeliveryTaskProfile p){
        var w=c.ref.content().workPackage();var material=new TreeMap<String,Object>();
        material.put("parent",Arrays.asList(w.scope(),w.deliverables(),w.acceptanceCriteria(),w.stageId(),w.itemIds(),w.milestoneIds()));
        for(UUID id:ids(p.itemIdsJson))material.put(id.toString(),c.scope.objects().stream().filter(o->o.id().equals(id)&&!o.archived()&&"ITEM".equals(o.kind())).map(o->o.content().item()).findFirst().orElse(null));
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json(material).getBytes(StandardCharsets.UTF_8)));}
        catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}
    }
    boolean needsReview(Context c,ProjectWorkItem w,DeliveryTaskProfile p){
        var source=c.ref.content().workPackage();
        return !p.scopeHash.equals(scopeHash(c,p))||p.startsOn.isBefore(source.startsOn())||w.dueDate.isAfter(source.endsOn());
    }
    List<UUID> validateFiles(SessionPrincipal actor,UUID projectId,List<UUID> input){
        var ids=input==null?List.<UUID>of():input;
        if(ids.size()>20||ids.stream().anyMatch(Objects::isNull)||ids.stream().distinct().count()!=ids.size())throw invalid("fileVersionIds","附件最多 20 项，不得重复或为空。");
        ids.forEach(id->files.requirePublished(actor,projectId,id,null));return List.copyOf(ids);
    }
    DeliveryTaskViews.Files visibleFiles(SessionPrincipal actor,UUID projectId,String json){
        var visible=new ArrayList<FileDirectory.VersionReference>();int restricted=0;
        for(UUID id:ids(json))try{visible.add(files.reference(actor,projectId,id));}catch(DomainException ignored){restricted++;}
        return new DeliveryTaskViews.Files(visible,restricted);
    }
    Object snapshot(ProjectWorkItem w,DeliveryTaskProfile p){
        var value=new LinkedHashMap<String,Object>();
        value.put("title",w.title);value.put("description",w.description);value.put("ownerId",w.ownerAccountId);value.put("verifierId",w.verifierAccountId);
        value.put("ownerName",access.name(w.ownerAccountId));value.put("verifierName",access.name(w.verifierAccountId));
        value.put("status",w.status);value.put("dueDate",w.dueDate);value.put("evidence",w.evidence);value.put("submittedBy",w.completedBy);value.put("verifiedBy",w.verifiedBy);value.put("verifiedAt",w.verifiedAt);
        if(p!=null){value.put("startsOn",p.startsOn);value.put("acceptanceCriteria",p.acceptanceCriteria);value.put("estimatedDays",p.estimatedDays);value.put("itemIds",ids(p.itemIdsJson));
            value.put("progress",p.progress);value.put("actualStartedOn",p.actualStartedOn);value.put("actualCompletedOn",p.actualCompletedOn);value.put("scopeHash",p.scopeHash);value.put("baselineVersion",p.baselineVersion);value.put("fileVersionIds",ids(p.filesJson));}
        return value;
    }
    DeliveryTaskViews.Snapshot visibleSnapshot(SessionPrincipal actor,UUID projectId,String json){
        var node=read(json,JsonNode.class);var projection=new DeliveryTaskViews.Files(List.of(),0);
        if(node instanceof com.fasterxml.jackson.databind.node.ObjectNode obj){var ids=obj.remove("fileVersionIds");if(ids!=null&&!ids.isNull())projection=visibleFiles(actor,projectId,ids.toString());}
        return new DeliveryTaskViews.Snapshot(json(node),projection);
    }
    void record(SessionPrincipal actor,ProjectWorkItem w,DeliveryTaskProfile p,String action,String note,Object before){
        var event=new DeliveryTaskEvent();event.projectId=w.projectId;event.taskId=w.id;event.actorId=actor.accountId();event.action=action;event.note=required(note,"note",4000);
        event.beforeJson=json(before);event.afterJson=json(snapshot(w,p));events.saveAndFlush(event);
        history.record(w.id,"DELIVERY_TASK","TASK_"+action,"原工作包任务已记录"+action+"，完整依据与版本见任务历史。",actor.accountId());
    }
    void versions(ProjectWorkItem w,DeliveryTaskProfile p,Long workVersion,Long profileVersion){if(workVersion==null||profileVersion==null)throw invalid("version","缺少当前任务版本。");version(w,workVersion);version(p,profileVersion);}
    String json(Object value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
    <T>T read(String json,Class<T> type){try{return mapper.readValue(json,type);}catch(Exception e){throw new IllegalStateException(e);}}
    static LocalDate today(){return LocalDate.now(ZoneId.of("Asia/Shanghai"));}
    record Context(ProjectDirectory.ProjectContext project,Scope scope,ObjectReference ref,ProjectWorkItem parent,ExecutionDirectory.StageState stage){}
}
