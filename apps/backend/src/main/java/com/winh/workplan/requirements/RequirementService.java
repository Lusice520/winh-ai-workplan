package com.winh.workplan.requirements;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.requirements.RequirementCommands.*;
import static com.winh.workplan.requirements.RequirementViews.*;
import com.winh.workplan.business.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.PageResponse;
import com.winh.workplan.project.ProjectDirectory;
import com.winh.workplan.project.ProjectResponsibilityContributor;
import com.winh.workplan.work.WorkDirectory;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
public class RequirementService implements ProjectResponsibilityContributor {
    private final ProjectRequirementRepository requirements;
    private final RequirementAssessmentRepository assessments;
    private final RequirementLinkRepository links;
    private final ProjectDirectory projects;
    private final WorkDirectory work;
    private final BusinessAccess access;
    private final BusinessHistory history;
    public RequirementService(ProjectRequirementRepository requirements,RequirementAssessmentRepository assessments,
            RequirementLinkRepository links,ProjectDirectory projects,WorkDirectory work,BusinessAccess access,BusinessHistory history){
        this.requirements=requirements;this.assessments=assessments;this.links=links;this.projects=projects;
        this.work=work;this.access=access;this.history=history;
    }
    public PageResponse<RequirementView> list(SessionPrincipal actor,String q,UUID projectId,String status,String source,String priority,
            UUID ownerAccountId,int page,int size){
        var visible=projects.visible(actor,"REQUIREMENT_READ").stream()
            .filter(p->projectId==null||projectId.equals(p.id())).collect(Collectors.toMap(ProjectDirectory.ProjectContext::id,p->p));
        if(visible.isEmpty())return page(List.of(),page,size);
        var rows=requirements.findAllByProjectIdInOrderByUpdatedAtDesc(visible.keySet()).stream()
            .filter(r->matches(q,r.code,r.title,r.originalText))
            .filter(r->status==null||status.isBlank()||status.equals(r.status))
            .filter(r->source==null||source.isBlank()||source.equals(r.source))
            .filter(r->priority==null||priority.isBlank()||priority.equals(r.priority))
            .filter(r->ownerAccountId==null||ownerAccountId.equals(r.ownerAccountId))
            .map(r->view(r,visible.get(r.projectId).name())).toList();
        return page(rows,page,size);
    }
    public Detail detail(SessionPrincipal actor,UUID id){
        var r=record(id);var p=projects.requireReadable(actor,r.projectId,"REQUIREMENT_READ");
        var actions=access.actions(actor,p.authorization(),"REQUIREMENT_EDIT","REQUIREMENT_VERIFY");
        if("CLOSED".equals(p.status()))actions=List.of();
        return new Detail(view(r,p.name()),assessments.findAllByRequirementIdOrderByCreatedAtDesc(id).stream().map(this::view).toList(),
            links.findAllByRequirementIdOrderByCreatedAtAsc(id).stream().map(l->linkView(actor,r,l)).toList(),history.list(id),actions);
    }
    @Transactional public Detail create(SessionPrincipal actor,CreateRequirement input){
        projects.requireWritable(actor,input.projectId(),"REQUIREMENT_CREATE");
        var reservation=access.reserve(actor,"rr.create",input.requestId(),input);
        if(reservation.replayed())return detail(actor,reservation.targetId());
        members(input.projectId(),input.ownerAccountId(),input.verifierAccountId());
        var r=new ProjectRequirement();r.projectId=input.projectId();r.code="REQ-"+r.id.toString().substring(0,8).toUpperCase(Locale.ROOT);
        r.title=required(input.title(),"title",160);r.originalText=required(input.originalText(),"originalText",8000);
        r.source=choice(input.source(),"source","SALES","PRESALES","DELIVERY","CUSTOMER","INTERNAL");
        r.requester=required(input.requester(),"requester",160);r.createdBy=actor.accountId();
        r.ownerAccountId=input.ownerAccountId();r.verifierAccountId=input.verifierAccountId();r.handlerIds=r.ownerAccountId.toString();
        r.priority=choice(input.priority(),"priority","LOW","NORMAL","HIGH","URGENT");r.expectedOn=input.expectedOn();r.importantCustomer=input.importantCustomer();r.status="NEW";
        requirements.saveAndFlush(r);history.record(r.id,"REQUIREMENT","REQUIREMENT_CREATED","原始需求已登记，等待澄清；原文保持不覆盖。",actor.accountId());
        access.complete(reservation,r.id);return detail(actor,r.id);
    }
    @Transactional public Detail edit(SessionPrincipal actor,UUID id,EditRequirement input){
        var r=writable(actor,id,"REQUIREMENT_EDIT");var reservation=access.reserve(actor,"rr.edit:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);version(r,input.version());
        if(Set.of("CLOSED","REJECTED").contains(r.status))throw conflict("请先受控重开需求，再调整责任。");
        members(r.projectId,input.ownerAccountId(),input.verifierAccountId());
        String reason=required(input.reason(),"reason",1000);addHandler(r,input.ownerAccountId());
        if(handlers(r).contains(input.verifierAccountId().toString()))throw invalid("verifierAccountId","需求处理过的人员不能作为该需求验证人。");
        r.ownerAccountId=input.ownerAccountId();r.verifierAccountId=input.verifierAccountId();r.priority=choice(input.priority(),"priority","LOW","NORMAL","HIGH","URGENT");
        r.expectedOn=input.expectedOn();save(r,"REQUIREMENT_RESPONSIBILITY_CHANGED","调整责任/优先级/期望时间；"+reason,actor);
        access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional public Detail assess(SessionPrincipal actor,UUID id,AssessRequirement input){
        var r=writable(actor,id,"REQUIREMENT_EDIT");var reservation=access.reserve(actor,"rr.assess:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);version(r,input.version());
        if(!Set.of("NEW","ASSESSED","ON_HOLD").contains(r.status))throw conflict("当前需求应先完成退回或重开，再进行新一轮评估。");
        var a=new RequirementAssessment();a.requirementId=id;a.createdBy=actor.accountId();a.clarification=required(input.clarification(),"clarification",8000);
        a.category=required(input.category(),"category",80);a.scopeImpact=required(input.scopeImpact(),"scopeImpact",2000);
        a.technicalImpact=required(input.technicalImpact(),"technicalImpact",2000);a.scheduleImpact=required(input.scheduleImpact(),"scheduleImpact",2000);
        a.costImpact=required(input.costImpact(),"costImpact",2000);a.contractImpact=required(input.contractImpact(),"contractImpact",2000);
        a.acceptanceImpact=required(input.acceptanceImpact(),"acceptanceImpact",2000);a.safetyImpact=required(input.safetyImpact(),"safetyImpact",2000);
        a.baselineImpact=input.baselineImpact();assessments.saveAndFlush(a);r.status="ASSESSED";
        save(r,"REQUIREMENT_ASSESSED","完成澄清与七项影响评估；"+(a.baselineImpact?"影响已批准基线，须正式变更。":"当前评估不影响已批准基线。"),actor);
        access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional public Detail route(SessionPrincipal actor,UUID id,RouteRequirement input){
        var r=writable(actor,id,"REQUIREMENT_EDIT");var reservation=access.reserve(actor,"rr.route:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);version(r,input.version());
        if(!"ASSESSED".equals(r.status))throw conflict("请先完成澄清与影响评估。");
        String destination=choice(input.disposition(),"disposition","DIRECT","HOLD","REJECT","TASK","ISSUE","WORK_PACKAGE","CHANGE");
        String reason=required(input.reason(),"reason",2000);var assessment=latestAssessment(id);
        if(assessment.baselineImpact&&!Set.of("CHANGE","HOLD","REJECT").contains(destination))throw invalid("disposition","影响已批准基线时，须派生或关联正式变更。");
        var previous=links.findAllByRequirementIdOrderByCreatedAtAsc(id);previous.forEach(l->{l.active=false;l.touch();});
        if(Set.of("TASK","ISSUE","WORK_PACKAGE","CHANGE").contains(destination)){
            var target=input.existingWorkItemId()==null
                ?work.create(actor,r.projectId,id,destination,r.title,assessment.clarification+"\n处理依据："+reason,r.ownerAccountId,r.verifierAccountId,r.expectedOn)
                :work.require(actor,r.projectId,input.existingWorkItemId());
            if(!destination.equals(target.kind()))throw invalid("existingWorkItemId","所选处理对象类型与去向不一致。");
            var link=new RequirementLink();link.requirementId=id;link.workItemId=target.id();link.kind=destination;link.active=true;links.save(link);
        }else if(input.existingWorkItemId()!=null)throw invalid("existingWorkItemId","当前处理去向不需要关联下游对象。");
        r.disposition=destination;r.status="HOLD".equals(destination)?"ON_HOLD":"REJECT".equals(destination)?"REJECTED":"IN_PROGRESS";
        save(r,"REQUIREMENT_ROUTED","人工选择 "+destination+"；"+reason,actor);access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional public Detail complete(SessionPrincipal actor,UUID id,CompleteRequirement input){
        var r=writable(actor,id,"REQUIREMENT_EDIT");var reservation=access.reserve(actor,"rr.complete:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);version(r,input.version());
        if(!"IN_PROGRESS".equals(r.status))throw conflict("只有处理中的需求可以提交完成证据。");
        verifyDownstream(actor,r);r.completionEvidence=required(input.evidence(),"evidence",4000);
        r.completedBy=actor.accountId();addHandler(r,actor.accountId());r.status="PENDING_VERIFICATION";
        save(r,"REQUIREMENT_COMPLETED","已提交完成证据，等待独立验证。",actor);access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional public Detail verify(SessionPrincipal actor,UUID id,VerifyRequirement input){
        var r=writable(actor,id,"REQUIREMENT_VERIFY");var reservation=access.reserve(actor,"rr.verify:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);version(r,input.version());
        if(!"PENDING_VERIFICATION".equals(r.status))throw conflict("需求尚未提交完成证据。");
        if(handlers(r).contains(actor.accountId().toString())||(!actor.accountId().equals(r.verifierAccountId)&&!actor.accountId().equals(r.createdBy)))
            throw conflict("处理人或完成提交人不能自行关闭；请由指定验证人或内部提出方确认。");
        String decision=choice(input.decision(),"decision","APPROVED","RETURNED");String comment=required(input.comment(),"comment",4000);
        if("APPROVED".equals(decision)){
            verifyDownstream(actor,r);
            if(r.importantCustomer)r.customerEvidence=required(input.customerEvidence(),"customerEvidence",4000);
            else r.customerEvidence=optional(input.customerEvidence(),"customerEvidence",4000);
            r.status="CLOSED";r.verifiedBy=actor.accountId();r.verifiedAt=Instant.now();
        }else r.status="IN_PROGRESS";
        r.verificationComment=comment;save(r,"REQUIREMENT_"+decision,comment,actor);
        access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional public Detail reopen(SessionPrincipal actor,UUID id,ReopenRequirement input){
        var r=writable(actor,id,"REQUIREMENT_EDIT");var reservation=access.reserve(actor,"rr.reopen:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);version(r,input.version());
        if(!Set.of("CLOSED","REJECTED","ON_HOLD").contains(r.status))throw conflict("当前需求无需重开。");
        String reason=required(input.reason(),"reason",2000);r.status="NEW";
        save(r,"REQUIREMENT_REOPENED","需求受控重开，原始需求与历史保留；"+reason,actor);access.complete(reservation,id);return detail(actor,id);
    }
    @EventListener public void checkRemoval(ProjectDirectory.MemberRemovalRequested event){
        if(requirements.findAllByProjectIdInOrderByUpdatedAtDesc(List.of(event.projectId())).stream()
                .anyMatch(r->!Set.of("CLOSED","REJECTED").contains(r.status)&&(event.accountId().equals(r.ownerAccountId)||event.accountId().equals(r.verifierAccountId))))
            throw conflict("该成员仍是未完成需求的处理人或验证人，请先交接。");
    }
    private void verifyDownstream(SessionPrincipal actor,ProjectRequirement r){
        var targets=links.findAllByRequirementIdOrderByCreatedAtAsc(r.id).stream().filter(l->l.active).map(l->work.require(actor,r.projectId,l.workItemId)).toList();
        if(targets.stream().anyMatch(w->!"DONE".equals(w.status())))throw conflict("关联处理对象尚未完成验证，请先处理下游记录。");
        if(latestAssessment(r.id).baselineImpact&&targets.stream().noneMatch(w->"CHANGE".equals(w.kind())&&w.approved()&&"DONE".equals(w.status())))
            throw conflict("缺少已批准并完成验证的正式变更，不能关闭基线相关需求。");
    }
    @Override public String responsibilityDomain(){return "REQUIREMENT";}
    @Override public List<Responsibility> responsibilities(SessionPrincipal actor,UUID projectId,UUID fromId,UUID toId){
        projects.requireReadable(actor,projectId,"REQUIREMENT_READ");
        return requirements.findAllByProjectIdInOrderByUpdatedAtDesc(List.of(projectId)).stream()
            .filter(r->!Set.of("CLOSED","REJECTED").contains(r.status)&&(fromId.equals(r.ownerAccountId)||fromId.equals(r.verifierAccountId)))
            .sorted(Comparator.comparing(r->r.id)).map(r->{
                UUID owner=fromId.equals(r.ownerAccountId)?toId:r.ownerAccountId,verifier=fromId.equals(r.verifierAccountId)?toId:r.verifierAccountId;
                if(owner.equals(verifier)||handlers(r).contains(verifier.toString()))throw conflict(r.title+"：接任验证人曾处理过此需求，不能独立验证。");
                return new Responsibility("REQUIREMENT",r.id,r.version,r.title,List.of(fromId.equals(r.ownerAccountId)?"需求负责人":"需求验证人"));
            }).toList();
    }
    @Override @Transactional public void transferResponsibilities(SessionPrincipal actor,UUID projectId,UUID fromId,UUID toId,List<Responsibility> expected,String reason){
        if(expected.isEmpty())return;projects.requireWritable(actor,projectId,"REQUIREMENT_EDIT");
        if(!responsibilities(actor,projectId,fromId,toId).equals(expected))throw conflict("未结需求已变化，请重新预览交接。");
        for(var expectedItem:expected){var r=record(expectedItem.objectId());boolean owner=fromId.equals(r.ownerAccountId);
            if(owner){r.ownerAccountId=toId;addHandler(r,toId);}else r.verifierAccountId=toId;
            save(r,"REQUIREMENT_RESPONSIBILITY_TRANSFERRED","责任由 "+access.name(fromId)+" 交接给 "+access.name(toId)+"；"+reason,actor);
        }
    }
    @Override public void validateRecipient(UUID projectId,UUID toId,List<Responsibility> responsibilities){
        var account=access.account(toId);var nextActor=new SessionPrincipal(toId,account.loginName(),account.displayName(),false,false,new UUID(0,0));
        for(var item:responsibilities)projects.requireReadable(nextActor,projectId,item.roles().contains("需求负责人")?"REQUIREMENT_EDIT":"REQUIREMENT_VERIFY");
    }
    private ProjectRequirement record(UUID id){return requirements.findById(id).orElseThrow(BusinessRules::missing);}
    private ProjectRequirement writable(SessionPrincipal actor,UUID id,String permission){var r=record(id);projects.requireWritable(actor,r.projectId,permission);return r;}
    private RequirementAssessment latestAssessment(UUID id){return assessments.findAllByRequirementIdOrderByCreatedAtDesc(id).stream().findFirst().orElseThrow(()->conflict("缺少影响评估。"));}
    private void members(UUID project,UUID owner,UUID verifier){
        if(owner==null||verifier==null||owner.equals(verifier))throw invalid("verifierAccountId","请指定不同的处理人和验证人。");
        for(UUID id:List.of(owner,verifier)){access.account(id);if(!projects.participant(project,id))throw invalid("ownerAccountId","处理人和验证人须为当前项目有效成员。");}
    }
    private Set<String> handlers(ProjectRequirement r){return new LinkedHashSet<>(Arrays.asList(r.handlerIds.split(",")));}
    private void addHandler(ProjectRequirement r,UUID id){var set=handlers(r);set.add(id.toString());r.handlerIds=String.join(",",set);}
    private void save(ProjectRequirement r,String action,String description,SessionPrincipal actor){r.touch();requirements.flush();history.record(r.id,"REQUIREMENT",action,description,actor.accountId());}
    private RequirementView view(ProjectRequirement r,String projectName){return new RequirementView(r.id,r.version,r.code,r.projectId,projectName,r.title,
        r.originalText,r.source,r.requester,r.createdBy,r.ownerAccountId,access.name(r.ownerAccountId),r.verifierAccountId,access.name(r.verifierAccountId),
        r.priority,r.status,r.expectedOn,r.importantCustomer,r.disposition,r.completionEvidence,r.verificationComment,r.customerEvidence,
        access.name(r.completedBy),access.name(r.verifiedBy),r.verifiedAt,r.updatedAt);}
    private AssessmentView view(RequirementAssessment a){return new AssessmentView(a.id,a.clarification,a.category,a.scopeImpact,a.technicalImpact,
        a.scheduleImpact,a.costImpact,a.contractImpact,a.acceptanceImpact,a.safetyImpact,a.baselineImpact,access.name(a.createdBy),a.createdAt);}
    private LinkView linkView(SessionPrincipal actor,ProjectRequirement r,RequirementLink l){
        var p=projects.requireReadable(actor,r.projectId,"REQUIREMENT_READ");
        if(!access.allows(actor,"WORK_READ",p.authorization()))return new LinkView(l.id,null,l.kind,"处理对象受限","RESTRICTED",l.active,false);
        var w=work.require(actor,r.projectId,l.workItemId);return new LinkView(l.id,w.id(),w.kind(),w.title(),w.status(),l.active,w.approved());
    }
}
