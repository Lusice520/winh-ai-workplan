package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.delivery.baseline.DeliveryCommands.*;
import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
class DeliveryPreparationService {
    final DeliveryStore s;
    private final org.springframework.context.ApplicationEventPublisher events;
    DeliveryPreparationService(DeliveryStore store,org.springframework.context.ApplicationEventPublisher events){this.s=store;this.events=events;}
    Workspace initialize(SessionPrincipal actor,UUID projectId,Initialize input){
        var project=s.projects.requireWritable(actor,projectId,"DG2_EDIT");
        var reservation=s.access.reserve(actor,"delivery.initialize:"+projectId,input.requestId(),input);
        if(reservation.replayed())return s.workspace(actor,projectId);
        if(!"PRESALES".equals(project.mainStage())||!"ACTIVE".equals(project.status()))throw conflict("仅已投入立项且仍在售前的原项目可开始交付准备。");
        if(s.cases.findByProjectId(projectId).isPresent())throw conflict("本项目已开始立项准备，请打开原记录。");
        var h=DeliveryRules.header(input.header());if(!actor.accountId().equals(h.projectManagerId()))throw invalid("projectManagerId","请由拟承担项目经理责任的本人开始准备。");
        s.member(projectId,h.projectManagerId());if(h.technicalLeadId()!=null)s.member(projectId,h.technicalLeadId());
        var source=s.handover.requireCurrentPackage(actor,projectId);
        if(!h.projectType().equals(source.projectType()))throw invalid("projectType","项目类型须与当前移交包一致。");
        var c=new DeliveryCase();c.projectId=projectId;c.managerId=h.projectManagerId();c.preparedBy=actor.accountId();c.headerJson=s.codec.write(h);
        c.handoverPackageId=source.id();c.handoverJson=s.codec.write(source);s.cases.saveAndFlush(c);
        s.record(c,c.id,"HEADER",c.version,null,c.headerJson,actor.accountId(),"开始原项目交付立项准备。",null,null);
        s.access.complete(reservation,c.id);return s.workspace(actor,projectId);
    }
    Workspace header(SessionPrincipal actor,UUID projectId,UpdateHeader input){
        var c=s.writable(actor,projectId,"DG2_EDIT");s.manager(actor,c);
        var res=s.access.reserve(actor,"delivery.header:"+c.id,input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());s.editable(c);
        if("APPROVED".equals(c.status))throw conflict("批准后的团队与接收责任请通过责任交接办理。");
        var h=DeliveryRules.header(input.header());s.member(projectId,h.projectManagerId());if(h.technicalLeadId()!=null)s.member(projectId,h.technicalLeadId());
        if(!h.projectType().equals(s.snapshot(c).handover().projectType()))throw invalid("projectType","项目类型须与接收的移交包一致。");
        String before=c.headerJson;c.headerJson=s.codec.write(h);c.managerId=h.projectManagerId();c.preparedBy=actor.accountId();s.touch(c);
        s.record(c,c.id,"HEADER",c.version,before,c.headerJson,actor.accountId(),input.reason(),null,null);s.access.complete(res,c.id);
        return s.workspace(actor,projectId);
    }
    Workspace refreshSource(SessionPrincipal actor,UUID projectId,Submit input){
        var c=s.writable(actor,projectId,"DG2_EDIT");s.manager(actor,c);
        var res=s.access.reserve(actor,"delivery.source:"+c.id,input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());s.editable(c);
        if("APPROVED".equals(c.status))throw conflict("批准基线的来源保持原快照，请通过后续变更处理新商务依据。");
        var source=s.handover.requireCurrentPackage(actor,projectId);if(source.id().equals(c.handoverPackageId)&&source.hash().equals(s.snapshot(c).handover().hash()))throw conflict("接收的来源已是当前版本。");
        String before=c.handoverJson;c.handoverPackageId=source.id();c.handoverJson=s.codec.write(source);var h=s.codec.read(c.headerJson,Header.class);
        c.headerJson=s.codec.write(new Header(h.projectManagerId(),h.technicalLeadId(),source.projectType(),h.riskLevel(),null,null,null,null));c.preparedBy=actor.accountId();s.touch(c);
        s.record(c,c.id,"SOURCE",c.version,before,c.handoverJson,actor.accountId(),required(input.note(),"note",2000),null,null);
        s.access.complete(res,c.id);return s.workspace(actor,projectId);
    }
    Workspace select(SessionPrincipal actor,UUID projectId,SelectConfiguration input){
        var c=s.writable(actor,projectId,"DG2_EDIT");s.manager(actor,c);
        var res=s.access.reserve(actor,"delivery.select:"+c.id,input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());s.editable(c);
        if("APPROVED".equals(c.status))throw conflict("已批准项目继续沿用其发布配置快照。");
        var kind=choice(input.kind(),"kind","STAGE_TEMPLATE","REVIEW_POLICY");
        if(input.editionId()==null)throw invalid("editionId","请选择已发布的配置版本。");
        var config=s.configurations.requireSelectable(actor,projectId,input.editionId(),kind);var header=s.codec.read(c.headerJson,Header.class);
        var types=config.template()!=null?config.template().projectTypes():config.policy().projectTypes();
        if(!types.contains(header.projectType()))throw invalid("editionId","此配置不适用当前项目类型。");
        String before;
        if("STAGE_TEMPLATE".equals(kind)){
            if(c.templateEditionId!=null||!s.objects.findAllByCaseIdOrderByCreatedAtAsc(c.id).isEmpty())throw conflict("项目已建立阶段快照，请维护原阶段及差异，不能用下拉框覆盖已有工作。");
            before=c.templateJson;c.templateEditionId=config.id();c.templateJson=s.codec.write(config);
            var ids=new LinkedHashMap<String,UUID>();config.template().stages().forEach(stage->ids.put(stage.code(),UUID.randomUUID()));
            for(var template:config.template().stages()){
                var stage=new Stage(template.code(),template.name(),"REQUIRED".equals(template.applicability()),null,null,null,null,null,
                    template.predecessorCodes().stream().map(ids::get).toList(),template.parallelCodes().stream().map(ids::get).toList(),
                    false,template.actions(),template.deliverables(),template.completionCriteria());
                var o=new DeliveryObject();o.id=ids.get(template.code());o.caseId=c.id;o.kind="STAGE";o.contentJson=s.codec.write(Content.of(stage));o.preparedBy=actor.accountId();s.objects.saveAndFlush(o);
                s.record(c,o.id,o.kind,o.version,null,o.contentJson,actor.accountId(),"从明确选择的发布模板生成项目阶段草案。",null,null);
            }
        }else{before=c.policyJson;c.policyEditionId=config.id();c.policyJson=s.codec.write(config);}
        c.preparedBy=actor.accountId();s.touch(c);s.record(c,c.id,"STAGE_TEMPLATE".equals(kind)?"TEMPLATE":"POLICY",c.version,before,s.codec.write(config),actor.accountId(),input.reason(),null,null);
        s.access.complete(res,c.id);return s.workspace(actor,projectId);
    }
    Workspace save(SessionPrincipal actor,UUID projectId,UUID id,SaveObject input){
        var c=s.writable(actor,projectId,"DG2_EDIT");var content=DeliveryRules.content(input.content());
        var res=s.access.reserve(actor,"dg2.object:"+Objects.toString(id,c.id+":new"),input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());s.editable(c);
        var old=id==null?null:s.object(c,id);
        if(old==null){
            if(Set.of("PLAN","ITEM").contains(content.kind()))s.responsible(actor,c,content,content);else s.manager(actor,c);
        }else{
            version(old,input.objectVersion());if(old.archived)throw conflict("已停用对象请通过有依据的范围调整处理，不能直接覆盖。");
            if(!old.kind.equals(content.kind()))throw invalid("content","不能改变原对象类型。");
            s.responsible(actor,c,s.codec.read(old.contentJson,Content.class),content);
        }
        s.validateReferences(actor,c,content);String reason=required(input.reason(),"reason",2000);
        if(content.stage()!=null){
            String previous=old==null?null:s.codec.read(old.contentJson,Content.class).stage().templateCode();
            if(!Objects.equals(previous,content.stage().templateCode()))throw invalid("templateCode","模板来源不可改写；新增阶段应说明差异理由。");
            if(previous==null&&DeliveryRules.blank(content.stage().differenceReason()))throw invalid("differenceReason","新增阶段请说明差异理由。");
        }
        if("APPROVED".equals(c.status)){
            if(old==null)throw conflict("已批准范围新增对象须先建立完整范围变更提案。");
            required(input.impact(),"impact",4000);required(input.basis(),"basis",4000);
            if(!Set.of("MILESTONE","BUDGET").contains(content.kind())){
                if(s.changes.existsByCaseIdAndObjectIdAndStatus(c.id,old.id,"PENDING"))throw conflict("此对象已有待确认的范围变更。");
                var change=new DeliveryChange();change.caseId=c.id;change.objectId=old.id;change.expectedObjectVersion=old.version;change.contentJson=s.codec.write(content);
                change.submittedBy=actor.accountId();change.reason=reason;change.impact=input.impact().trim();change.basis=input.basis().trim();s.changes.saveAndFlush(change);s.touch(c);
                s.history.record(c.id,"DELIVERY_INITIATION","DELIVERY_CHANGE_SUBMITTED","提出"+DeliveryStore.label(content.kind())+"范围变更，当前批准内容保持原版。",actor.accountId());
                s.access.complete(res,change.id);return s.workspace(actor,projectId);
            }
            s.manager(actor,c);
        }
        var o=old==null?new DeliveryObject():old;String before=old==null?null:old.contentJson;
        if(old==null){
            var all=s.objects.findAllByCaseIdOrderByCreatedAtAsc(c.id);if(all.size()>=300)throw conflict("当前基线对象超过 300 项，请先分清项目范围后继续维护。");
            if("BUDGET".equals(content.kind())&&all.stream().anyMatch(x->"BUDGET".equals(x.kind)&&!x.archived))throw conflict("项目已有实施预算，请维护原预算。");
        }
        if(content.workPackage()!=null){
            var w=content.workPackage();UUID existing=old==null?input.existingWorkItemId():old.id;
            if(old==null&&existing!=null){
                if(s.objects.existsById(existing))throw conflict("此工作包已经接纳，请打开原记录维护。");
                before=s.codec.write(s.work.require(actor,projectId,existing));
            }
            o.id=s.work.registerDeliveryPackage(actor,projectId,existing,w.title(),w.scope(),w.ownerId(),w.verifierId(),w.endsOn()).id();
        }else if(input.existingWorkItemId()!=null)throw invalid("existingWorkItemId","仅工作包可接纳原工作记录。");
        o.caseId=c.id;o.kind=content.kind();o.contentJson=s.codec.write(content);o.preparedBy=actor.accountId();o.touch();s.objects.saveAndFlush(o);s.touch(c);
        s.record(c,o.id,o.kind,o.version,before,o.contentJson,actor.accountId(),reason,input.impact(),input.basis());
        if("APPROVED".equals(c.status)){
            validateCurrentStructure(c);publishRevision(c,actor.accountId(),"项目经理直接调整"+DeliveryStore.label(o.kind)+"，原批准版本保留。",o);
        }
        s.access.complete(res,o.id);return s.workspace(actor,projectId);
    }
    Workspace archive(SessionPrincipal actor,UUID projectId,UUID id,ArchiveObject input){
        var c=s.writable(actor,projectId,"DG2_EDIT");s.manager(actor,c);var res=s.access.reserve(actor,"delivery.archive:"+id,input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());s.editable(c);var o=s.object(c,id);version(o,input.objectVersion());
        String reason=required(input.reason(),"reason",2000);if(o.archived)throw conflict("此对象已停用。");
        if("BUDGET".equals(o.kind))throw conflict("预算采用同一对象修订，不通过停用删除批准范围。");
        if("APPROVED".equals(c.status)){
            if(s.changes.existsByCaseIdAndObjectIdAndStatus(c.id,id,"PENDING"))throw conflict("此对象已有待确认变更。");
            var proposal=new DeliveryChange();proposal.caseId=c.id;proposal.objectId=id;proposal.expectedObjectVersion=o.version;proposal.contentJson=o.contentJson;
            proposal.archiveRequested=true;proposal.submittedBy=actor.accountId();proposal.reason=reason;
            proposal.impact=required(input.impact(),"impact",4000);proposal.basis=required(input.basis(),"basis",4000);s.changes.saveAndFlush(proposal);
            s.touch(c);s.access.complete(res,proposal.id);return s.workspace(actor,projectId);
        }
        String before=s.codec.write(s.objectFact(o));o.archived=true;o.preparedBy=actor.accountId();o.touch();s.objects.flush();s.touch(c);
        s.record(c,id,o.kind,o.version,before,s.codec.write(s.objectFact(o)),actor.accountId(),reason,null,null);s.access.complete(res,id);return s.workspace(actor,projectId);
    }
    void validateCurrentStructure(DeliveryCase c){
        var snapshot=s.snapshot(c);var problems=new ArrayList<String>();
        problems.addAll(DeliveryRules.stageProblems(snapshot.objects(),snapshot.template()==null?null:snapshot.template().template()));
        problems.addAll(DeliveryRules.planProblems(snapshot.objects()));problems.addAll(DeliveryRules.scopeProblems(snapshot.objects()));
        problems.addAll(DeliveryRules.budgetProblems(snapshot.objects(),snapshot.resources(),java.time.LocalDate.now()));
        problems.addAll(s.teamProblems(c,snapshot));
        if(!problems.isEmpty())throw conflict("调整后的基线仍须保持可执行关系："+problems.getFirst());
    }
    void publishRevision(DeliveryCase c,UUID actorId,String reason,DeliveryObject changed){
        changed.baselineVersion=++c.baselineVersion;changed.touch();s.objects.flush();
        if(!"BUDGET".equals(changed.kind))events.publishEvent(new com.winh.workplan.delivery.ApprovedDeliveryDirectory.BaselineApplied(c.projectId,
            List.of(new com.winh.workplan.delivery.ApprovedDeliveryDirectory.ObjectReference(changed.id,changed.version,changed.kind,s.codec.read(changed.contentJson,Content.class),changed.archived,changed.baselineVersion)),c.baselineVersion,actorId));
        if("WORK_PACKAGE".equals(changed.kind))s.work.setDeliveryState(c.projectId,List.of(changed.id),changed.archived?"RETIRED":"BASELINED",c.baselineVersion);
        s.touch(c);var snap=s.snapshot(c);
        var baseline=new DeliveryBaseline();baseline.caseId=c.id;baseline.baselineVersion=c.baselineVersion;baseline.snapshotJson=s.codec.write(snap);
        baseline.snapshotHash=s.codec.hash(snap);baseline.approvedBy=actorId;baseline.reason=reason;s.baselines.saveAndFlush(baseline);
        s.history.record(c.id,"DELIVERY_INITIATION","DELIVERY_BASELINE_REVISED","当前有效基线更新为 V"+c.baselineVersion+"；历史版本保持不变。",actorId);
    }
}
