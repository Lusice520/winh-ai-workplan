package com.winh.workplan.work;
import static com.winh.workplan.business.BusinessRules.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import com.winh.workplan.business.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.project.ProjectDirectory;
import com.winh.workplan.project.ProjectResponsibilityContributor;
import jakarta.validation.constraints.*;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
public class WorkService implements WorkDirectory,ProjectResponsibilityContributor {
    private final WorkItemRepository repository;
    private final DeliveryTaskProfileRepository taskProfiles;
    private final ProjectDirectory projects;
    private final BusinessAccess access;
    private final BusinessHistory history;
    private final org.springframework.context.ApplicationEventPublisher publisher;
    public WorkService(WorkItemRepository repository,ProjectDirectory projects,BusinessAccess access,BusinessHistory history,org.springframework.context.ApplicationEventPublisher publisher,DeliveryTaskProfileRepository taskProfiles){
        this.repository=repository;this.projects=projects;this.access=access;this.history=history;this.publisher=publisher;this.taskProfiles=taskProfiles;
    }
    @Override @Transactional
    public WorkReference create(SessionPrincipal actor,UUID projectId,UUID requirementId,String kind,String title,
            String description,UUID owner,UUID verifier,LocalDate dueDate){
        projects.requireWritable(actor,projectId,"WORK_EDIT");
        if(owner.equals(verifier))throw invalid("verifierAccountId","处理人与验证人不能相同。");
        for(UUID member:List.of(owner,verifier)){
            access.account(member);if(!projects.participant(projectId,member))throw invalid("ownerAccountId","处理人与验证人须为当前项目成员。");
        }
        var w=new ProjectWorkItem();w.projectId=projectId;w.sourceRequirementId=requirementId;
        w.kind=choice(kind,"kind","TASK","ISSUE","WORK_PACKAGE","CHANGE");w.title=required(title,"title",160);w.description=required(description,"description",8000);
        if("WORK_PACKAGE".equals(w.kind))w.deliveryState="AWAITING_BASELINE";
        w.ownerAccountId=owner;w.verifierAccountId=verifier;w.dueDate=dueDate;w.createdBy=actor.accountId();repository.saveAndFlush(w);
        history.record(w.id,"WORK_ITEM","WORK_ITEM_CREATED","从原需求人工派生 "+kind+"。",actor.accountId());return reference(w);
    }
    @Override @Transactional(readOnly=true,noRollbackFor=com.winh.workplan.iam.shared.DomainException.class)
    public WorkReference require(SessionPrincipal actor,UUID projectId,UUID id){
        projects.requireReadable(actor,projectId,"WORK_READ");var w=repository.findById(id).filter(x->x.projectId.equals(projectId)).orElseThrow(BusinessRules::missing);return readReference(actor,w);
    }
    public List<WorkReference> list(SessionPrincipal actor,UUID projectId,String kind){
        projects.requireReadable(actor,projectId,"WORK_READ");return repository.findAllByProjectIdOrderByUpdatedAtDesc(projectId).stream()
            .filter(w->kind==null||kind.isBlank()||kind.equals(w.kind)).map(w->readReference(actor,w)).toList();
    }
    public WorkView detail(SessionPrincipal actor,UUID id){
        var w=repository.findById(id).orElseThrow(BusinessRules::missing);var p=projects.requireReadable(actor,w.projectId,"WORK_READ");
        return new WorkView(w.id,w.version,w.projectId,p.name(),w.sourceRequirementId,w.kind,w.title,w.description,
            w.ownerAccountId,access.name(w.ownerAccountId),w.verifierAccountId,access.name(w.verifierAccountId),w.status,
            w.dueDate,w.evidence,access.name(w.approvedBy),w.approvedAt,access.name(w.verifiedBy),w.verifiedAt,
            w.creationSource,w.deliveryState,w.deliveryBaselineVersion,taskProfiles.findById(w.id).map(t->t.workPackageId).orElse(null),history.list(w.id),actions(actor,w,p));
    }
    @Transactional public WorkView transition(SessionPrincipal actor,UUID id,Transition input){
        var w=repository.findById(id).orElseThrow(BusinessRules::missing);
        String action=choice(input.action(),"action","SUBMIT","APPROVE","RETURN","COMPLETE","VERIFY");
        projects.requireWritable(actor,w.projectId,Set.of("APPROVE","RETURN","VERIFY").contains(action)?"WORK_REVIEW":"WORK_EDIT");
        if(taskProfiles.existsById(id))throw conflict("此任务已接续原工作包，请从任务执行入口提交日期、成果与独立验证。");
        var reservation=access.reserve(actor,"work.transition:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);
        // The project lock serializes all changes, including requirement/close operations.
        version(w,input.version());String evidence=required(input.evidence(),"evidence",4000);String previous=w.status;
        if("WORK_PACKAGE".equals(w.kind)&&!"BASELINED".equals(w.deliveryState))
            throw conflict("请先完成 DG-02；当前工作包尚不能记录正式交付完成或验证，评审中也不能从原入口改写。");
        if("WORK_PACKAGE".equals(w.kind))publisher.publishEvent(new BeforeExecutionAction(actor,reference(w),action));
        switch(action){
            case "SUBMIT" -> {
                if(!"CHANGE".equals(w.kind)||!"OPEN".equals(w.status))throw conflict("仅未提交的变更申请可以提交审批。");
                w.status="SUBMITTED";
            }
            case "APPROVE" -> {
                if(!"CHANGE".equals(w.kind)||!"SUBMITTED".equals(w.status))throw conflict("仅待审批变更可以批准。");
                if(actor.accountId().equals(w.createdBy)||!projects.participant(w.projectId,actor.accountId()))throw conflict("变更须由另一名授权项目成员审批。");
                w.status="APPROVED";w.approvedBy=actor.accountId();w.approvedAt=Instant.now();
            }
            case "COMPLETE" -> {
                if(!("CHANGE".equals(w.kind)?"APPROVED":"OPEN").equals(w.status))throw conflict("当前记录不具备完成条件；变更需先批准。");
                if("WORK_PACKAGE".equals(w.kind)&&!actor.accountId().equals(w.ownerAccountId))throw conflict("工作包完成证据须由当前实际负责人提交。");
                w.status="PENDING_VERIFICATION";w.completedBy=actor.accountId();w.evidence=evidence;
            }
            case "VERIFY" -> {
                if(!"PENDING_VERIFICATION".equals(w.status))throw conflict("请先提交完成证据。");
                independent(w,actor);w.status="DONE";w.verifiedBy=actor.accountId();w.verifiedAt=Instant.now();
            }
            case "RETURN" -> {
                if("SUBMITTED".equals(w.status)&&"CHANGE".equals(w.kind)){
                    if(actor.accountId().equals(w.createdBy))throw conflict("申请人不能审核自己的变更。");w.status="OPEN";
                }else if("PENDING_VERIFICATION".equals(w.status)){
                    independent(w,actor);w.status="CHANGE".equals(w.kind)?"APPROVED":"OPEN";
                }else throw conflict("仅待审批或待验证记录可以退回。");
            }
            default -> throw invalid("action","无效操作。");
        }
        w.touch();repository.flush();history.record(id,"WORK_ITEM","WORK_"+action,previous+" → "+w.status+"；"+evidence,actor.accountId());
        access.complete(reservation,id);return detail(actor,id);
    }
    @EventListener public void checkRemoval(ProjectDirectory.MemberRemovalRequested event){
        if(repository.findAllByProjectIdOrderByUpdatedAtDesc(event.projectId()).stream()
            .anyMatch(w->!Set.of("DONE","CANCELLED").contains(w.status)&&!"RETIRED".equals(w.deliveryState)&&(w.ownerAccountId.equals(event.accountId())||w.verifierAccountId.equals(event.accountId()))))
            throw conflict("该成员仍有未完成的需求处理记录，请先完成责任交接。");
    }
    private void independent(ProjectWorkItem w,SessionPrincipal actor){
        if(!actor.accountId().equals(w.verifierAccountId)||actor.accountId().equals(w.ownerAccountId)||actor.accountId().equals(w.completedBy))
            throw conflict("须由指定验证人确认，处理人或完成证据提交人不能自行验证。");
    }
    @Override @Transactional public WorkReference registerDeliveryPackage(SessionPrincipal actor,UUID projectId,UUID existingId,
            String title,String scope,UUID ownerId,UUID verifierId,LocalDate dueDate){
        projects.requireWritable(actor,projectId,"DG2_EDIT");projects.requireWritable(actor,projectId,"WORK_EDIT");
        var w=existingId==null?new ProjectWorkItem():repository.findById(existingId)
            .filter(x->x.projectId.equals(projectId)&&"WORK_PACKAGE".equals(x.kind)).orElseThrow(BusinessRules::missing);
        if(!"OPEN".equals(w.status)||Set.of("IN_REVIEW","BASELINED","RETIRED").contains(w.deliveryState))throw conflict("仅未完成且未冻结的工作包可以接纳或维护草案。");
        if(existingId==null){w.projectId=projectId;w.kind="WORK_PACKAGE";w.creationSource="DELIVERY";w.createdBy=actor.accountId();}
        if(ownerId.equals(verifierId))throw invalid("verifierId","工作包负责人和验证人不能相同。");
        for(UUID id:List.of(ownerId,verifierId)){access.account(id);if(!projects.participant(projectId,id))throw invalid("ownerId","工作包责任人须为有效项目成员。");}
        w.title=required(title,"title",160);w.description=required(scope,"scope",8000);w.ownerAccountId=ownerId;w.verifierAccountId=verifierId;
        w.dueDate=dueDate;w.deliveryState="PREPARING";w.touch();repository.saveAndFlush(w);
        history.record(w.id,"WORK_ITEM","WORK_DELIVERY_PREPARED",existingId==null?"由交付立项建立工作包。":"原工作包接续交付基线准备，身份和源需求关系保留。",actor.accountId());
        return reference(w);
    }
    @Override @Transactional public void setDeliveryState(UUID projectId,List<UUID> ids,String state,int baselineVersion){
        choice(state,"state","PREPARING","IN_REVIEW","BASELINED","RETIRED");
        for(UUID id:ids){var w=repository.findById(id).filter(x->x.projectId.equals(projectId)&&"WORK_PACKAGE".equals(x.kind)).orElseThrow(BusinessRules::missing);
            if("RETIRED".equals(state)&&!"OPEN".equals(w.status))throw conflict("工作包已有待验证或已完成的执行结果，不能停用原范围。");
            w.deliveryState=state;w.deliveryBaselineVersion=baselineVersion;w.touch();}
        repository.flush();
    }
    @Override @Transactional public void reviseDeliveryPackage(UUID projectId,UUID id,String title,String scope,UUID ownerId,UUID verifierId,LocalDate dueDate,UUID actorId){
        var w=repository.findById(id).filter(x->x.projectId.equals(projectId)&&"WORK_PACKAGE".equals(x.kind)).orElseThrow(BusinessRules::missing);
        if(!"OPEN".equals(w.status))throw conflict("已提交完成或已完成的工作包不能覆盖范围，请先处理执行责任。");
        w.title=required(title,"title",160);w.description=required(scope,"scope",8000);w.ownerAccountId=ownerId;w.verifierAccountId=verifierId;
        w.dueDate=dueDate;w.touch();repository.flush();
        history.record(id,"WORK_ITEM","WORK_DELIVERY_REVISED","交付范围经独立授权确认后更新当前工作包，原基线保留。",actorId);
    }
    private WorkReference reference(ProjectWorkItem w){return new WorkReference(w.id,w.projectId,w.kind,w.title,w.status,
        w.approvedBy!=null||"BASELINED".equals(w.deliveryState),w.version,w.sourceRequirementId,w.creationSource,w.ownerAccountId,w.verifierAccountId,
        w.dueDate,w.deliveryState,w.deliveryBaselineVersion);}
    private WorkReference readReference(SessionPrincipal actor,ProjectWorkItem w){
        var original=reference(w);if(!"DONE".equals(w.status)||!taskProfiles.existsById(w.id))return original;
        var status=new java.util.concurrent.atomic.AtomicReference<>(original.status());
        publisher.publishEvent(new CompletionEligibility(actor,original,status::set));
        return new WorkReference(original.id(),original.projectId(),original.kind(),original.title(),status.get(),original.approved(),original.version(),original.sourceRequirementId(),original.creationSource(),original.ownerId(),original.verifierId(),original.dueDate(),original.deliveryState(),original.deliveryBaselineVersion());
    }
    /** Trusted delivery boundary: called only after a locked, independently approved scope proposal. */
    @Override @Transactional public WorkReference approveDeliveryPackage(UUID projectId,UUID reservedId,Long expectedWorkVersion,
            String title,String scope,UUID ownerId,UUID verifierId,LocalDate dueDate,UUID actorId,int baselineVersion){
        ProjectWorkItem w;
        if(expectedWorkVersion==null){
            if(repository.existsById(reservedId))throw conflict("预留工作包标识已被使用，请重新建立提案。");
            w=new ProjectWorkItem();w.id=reservedId;w.projectId=projectId;w.kind="WORK_PACKAGE";w.creationSource="DELIVERY";w.createdBy=actorId;
        }else{
            w=repository.findById(reservedId).filter(x->x.projectId.equals(projectId)&&"WORK_PACKAGE".equals(x.kind)).orElseThrow(BusinessRules::missing);
            version(w,expectedWorkVersion);
            if(!"OPEN".equals(w.status)||Set.of("IN_REVIEW","RETIRED").contains(w.deliveryState))throw conflict("原工作包的执行或基线状态已变化，请重新核对范围。");
        }
        if(ownerId.equals(verifierId))throw invalid("verifierId","工作包负责人和验证人不能相同。");
        for(UUID person:List.of(ownerId,verifierId)){access.account(person);if(!projects.participant(projectId,person))throw invalid("ownerId","工作包责任人须为有效项目成员。");}
        w.title=required(title,"title",160);w.description=required(scope,"scope",8000);w.ownerAccountId=ownerId;w.verifierAccountId=verifierId;
        w.dueDate=dueDate;w.deliveryState="BASELINED";w.deliveryBaselineVersion=baselineVersion;w.touch();repository.saveAndFlush(w);
        history.record(w.id,"WORK_ITEM","WORK_DELIVERY_SCOPE_APPROVED","整组范围经独立授权确认，沿用原身份形成 V"+baselineVersion+" 工作包基线。",actorId);
        return reference(w);
    }
    @Override public Set<UUID> completedPackageIds(UUID projectId){
        return repository.findAllByProjectIdOrderByUpdatedAtDesc(projectId).stream().filter(w->"WORK_PACKAGE".equals(w.kind)&&"DONE".equals(w.status)).map(w->w.id).collect(java.util.stream.Collectors.toSet());
    }
    @Override public String responsibilityDomain(){return "WORK";}
    @Override public List<Responsibility> responsibilities(SessionPrincipal actor,UUID projectId,UUID fromId,UUID toId){
        projects.requireReadable(actor,projectId,"WORK_READ");
        return repository.findAllByProjectIdOrderByUpdatedAtDesc(projectId).stream()
            .filter(w->!Set.of("DONE","CANCELLED").contains(w.status)&&!"RETIRED".equals(w.deliveryState)&&(w.ownerAccountId.equals(fromId)||w.verifierAccountId.equals(fromId)))
            .sorted(Comparator.comparing(w->w.id)).map(w->{
                UUID owner=w.ownerAccountId.equals(fromId)?toId:w.ownerAccountId,verifier=w.verifierAccountId.equals(fromId)?toId:w.verifierAccountId;
                if(owner.equals(verifier)||verifier.equals(w.completedBy))throw conflict(w.title+"：接任后处理人和验证人不独立。");
                return new Responsibility("WORK",w.id,w.version,w.title,List.of(w.ownerAccountId.equals(fromId)?"处理负责人":"指定验证人"));
            }).toList();
    }
    @Override @Transactional public void transferResponsibilities(SessionPrincipal actor,UUID projectId,UUID fromId,UUID toId,List<Responsibility> expected,String reason){
        if(expected.isEmpty())return;projects.requireWritable(actor,projectId,"WORK_EDIT");
        if(!responsibilities(actor,projectId,fromId,toId).equals(expected))throw conflict("未结工作记录已变化，请重新预览交接。");
        for(var expectedItem:expected){var w=repository.findById(expectedItem.objectId()).orElseThrow(BusinessRules::missing);
            var before=reference(w);
            boolean owner=w.ownerAccountId.equals(fromId);
            if(owner)w.ownerAccountId=toId;else w.verifierAccountId=toId;
            w.touch();history.record(w.id,"WORK_ITEM","WORK_RESPONSIBILITY_TRANSFERRED","责任由 "+access.name(fromId)+" 交接给 "+access.name(toId)+"；"+reason,actor.accountId());
            if(taskProfiles.existsById(w.id))publisher.publishEvent(new TaskResponsibilityTransferred(actor,before,reference(w),reason));
        }
        repository.flush();
    }
    @Override public void validateRecipient(UUID projectId,UUID toId,List<Responsibility> responsibilities){
        var account=access.account(toId);var nextActor=new SessionPrincipal(toId,account.loginName(),account.displayName(),false,false,new UUID(0,0));
        for(var item:responsibilities){projects.requireReadable(nextActor,projectId,item.roles().contains("处理负责人")?"WORK_EDIT":"WORK_REVIEW");
            if(taskProfiles.existsById(item.objectId())){projects.requireReadable(nextActor,projectId,"WORK_READ");projects.requireReadable(nextActor,projectId,"DG2_READ");projects.requireReadable(nextActor,projectId,"DELIVERY_EXECUTION_READ");}}
    }
    private List<String> actions(SessionPrincipal actor,ProjectWorkItem w,ProjectDirectory.ProjectContext project){
        if(taskProfiles.existsById(w.id))return List.of();
        if("CLOSED".equals(project.status())||"WORK_PACKAGE".equals(w.kind)&&!"BASELINED".equals(w.deliveryState))return List.of();
        boolean edit=access.allows(actor,"WORK_EDIT",project.authorization());
        boolean review=access.allows(actor,"WORK_REVIEW",project.authorization());
        var result=new ArrayList<String>();
        if(edit&&"CHANGE".equals(w.kind)&&"OPEN".equals(w.status))result.add("SUBMIT");
        if(review&&"CHANGE".equals(w.kind)&&"SUBMITTED".equals(w.status)&&!actor.accountId().equals(w.createdBy)&&projects.participant(w.projectId,actor.accountId()))result.addAll(List.of("APPROVE","RETURN"));
        if(edit&&("CHANGE".equals(w.kind)?"APPROVED":"OPEN").equals(w.status)&&(!"WORK_PACKAGE".equals(w.kind)||actor.accountId().equals(w.ownerAccountId)))result.add("COMPLETE");
        if(review&&"PENDING_VERIFICATION".equals(w.status)&&actor.accountId().equals(w.verifierAccountId)&&!actor.accountId().equals(w.ownerAccountId)&&!actor.accountId().equals(w.completedBy))result.addAll(List.of("VERIFY","RETURN"));
        if("WORK_PACKAGE".equals(w.kind)&&(result.contains("COMPLETE")||result.contains("VERIFY")))publisher.publishEvent(new ExecutionAvailability(actor,reference(w),result::remove));
        return List.copyOf(result);
    }
    public record Transition(@NotNull UUID requestId,@NotNull Long version,@NotBlank String action,@NotBlank String evidence){}
    public record WorkView(UUID id,long version,UUID projectId,String projectName,UUID sourceRequirementId,String kind,
        String title,String description,UUID ownerAccountId,String ownerName,UUID verifierAccountId,String verifierName,
        String status,LocalDate dueDate,String evidence,String approvedByName,Instant approvedAt,String verifiedByName,Instant verifiedAt,
        String creationSource,String deliveryState,int deliveryBaselineVersion,UUID taskWorkPackageId,List<BusinessHistory.EventView> history,List<String> allowedActions){}
}
