package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryScopes.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.delivery.DeliveryConfigurationDirectory.PublishedConfiguration;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
class DeliveryScopeService {
    private final DeliveryStore s;
    private final DeliveryScopeRules rules;
    private final DeliveryScopeRepository changes;
    private final DeliveryScopeSubmissionRepository submissions;
    private final DeliveryScopeEventRepository events;
    private final org.springframework.context.ApplicationEventPublisher publisher;
    DeliveryScopeService(DeliveryStore s,DeliveryScopeRules rules,DeliveryScopeRepository changes,DeliveryScopeSubmissionRepository submissions,DeliveryScopeEventRepository events,org.springframework.context.ApplicationEventPublisher publisher){
        this.s=s;this.rules=rules;this.changes=changes;this.submissions=submissions;this.events=events;this.publisher=publisher;
    }
    List<DeliveryScopes.Row> list(SessionPrincipal actor,UUID projectId){
        var p=s.projects.requireReadable(actor,projectId,"DG2_READ");var c=s.require(projectId);boolean money=s.allows(actor,p,"DELIVERY_BUDGET_READ");
        return changes.findAllByCaseIdOrderByCreatedAtDesc(c.id).stream().map(d->row(c,d,money)).toList();
    }
    View detail(SessionPrincipal actor,UUID projectId,UUID id){
        s.projects.requireReadable(actor,projectId,"DG2_READ");var c=s.require(projectId);return view(actor,c,require(c,id));
    }
    Frozen snapshot(SessionPrincipal actor,UUID projectId,UUID id,UUID submissionId){
        var p=s.projects.requireReadable(actor,projectId,"DG2_READ");var c=s.require(projectId);require(c,id);
        var round=submissions.findById(submissionId).filter(r->r.changeId.equals(id)).orElseThrow(BusinessRules::missing);
        var f=s.codec.read(round.frozenJson,Frozen.class);boolean money=s.allows(actor,p,"DELIVERY_BUDGET_READ");
        return new Frozen(f.baseBaselineVersion(),f.baseHash(),s.projectSnapshot(f.reference(),money),s.projectSnapshot(f.candidate(),money),projectDraft(f.draft(),money),
            money?f.reason():null,money?f.impact():null,money?f.basis():null,f.preparedBy());
    }
    @Transactional View create(SessionPrincipal actor,UUID projectId,Metadata input){
        var c=manager(actor,projectId);budgetRead(actor,c);
        var res=s.access.reserve(actor,"dg2.scope.create:"+c.id,input.requestId(),input);
        if(res.replayed())return view(actor,c,require(c,res.targetId()));version(c,input.version());
        if(changes.existsByCaseIdAndStatusIn(c.id,OPEN))throw conflict("本项目已有未结束的整组范围提案，请打开原草案继续维护。");
        var d=new DeliveryScopeChange();d.caseId=c.id;d.createdBy=actor.accountId();d.preparedBy=actor.accountId();captureBase(c,d);metadata(actor,c,d,input);
        changes.saveAndFlush(d);audit(c,d,actor,"CREATED","建立整组范围草案；当前有效基线继续执行。",input.reason());s.access.complete(res,d.id);return view(actor,c,d);
    }
    @Transactional View metadata(SessionPrincipal actor,UUID projectId,UUID id,Metadata input){
        var c=manager(actor,projectId);var d=require(c,id);budgetRead(actor,c);
        var res=s.access.reserve(actor,"dg2.scope.metadata:"+id,input.requestId(),input);
        if(res.replayed())return view(actor,c,d);version(d,input.version());editable(d);rules.requireFresh(actor,c,d,false);
        metadata(actor,c,d,input);changed(d,actor);audit(c,d,actor,"EDITED","更新整组提案的原因、影响与审批规则。",input.reason());s.access.complete(res,id);return view(actor,c,d);
    }
    @Transactional View saveObject(SessionPrincipal actor,UUID projectId,UUID id,UUID objectId,DeliveryCommands.SaveObject input){
        var c=manager(actor,projectId);var d=require(c,id);
        var res=s.access.reserve(actor,"dg2.sc.object:"+s.codec.hash(List.of(id.toString(),Objects.toString(objectId,"new"))),input.requestId(),input);
        if(res.replayed())return view(actor,c,d);version(d,input.version());editable(d);rules.requireFresh(actor,c,d,false);
        var content=DeliveryRules.content(input.content());var b=rules.candidate(d);
        if("BUDGET".equals(content.kind()))budgetEdit(actor,c);
        var previous=objectId==null?null:findObject(b,objectId);var draft=rules.draft(d);
        var prior=draft.objects().stream().filter(e->e.proposed().id().equals(objectId)).findFirst().orElse(null);
        Long workVersion=prior==null?null:prior.workVersion();boolean adopted=prior!=null&&prior.adopted();
        Long originalVersion=previous==null?null:prior==null?Long.valueOf(previous.version()):prior.originalVersion();
        UUID target=objectId==null?UUID.randomUUID():objectId;
        if(previous!=null){
            expected(previous.version(),input.objectVersion());if(previous.archived())throw conflict("已停用对象不能直接覆盖，请撤回本次停用或新增范围。");
            if(!previous.kind().equals(content.kind()))throw invalid("content","不能改变原对象类型。");
        }else if(b.objects().size()>=300)throw conflict("当前候选范围超过 300 项，请先梳理项目边界。");
        if(content.stage()!=null){
            var template=previous==null?null:previous.content().stage().templateCode();
            if(!Objects.equals(template,content.stage().templateCode()))throw invalid("templateCode","模板来源不可改写。");
            if(template==null&&DeliveryRules.blank(content.stage().differenceReason()))throw invalid("differenceReason","新增阶段须说明差异理由。");
        }
        if(content.workPackage()!=null){
            s.projects.requireReadable(actor,projectId,"WORK_EDIT");
            if(previous==null&&input.existingWorkItemId()!=null){
                target=input.existingWorkItemId();if(s.objects.existsById(target)||b.objects().stream().anyMatch(o->o.id().equals(input.existingWorkItemId())))throw conflict("此原工作包已进入交付范围，请维护原记录。");
                var w=s.work.require(actor,projectId,target);
                if(!"WORK_PACKAGE".equals(w.kind())||!"OPEN".equals(w.status())||w.approved()||Set.of("BASELINED","IN_REVIEW","RETIRED").contains(w.deliveryState()))throw conflict("仅同项目未批准、未冻结、未完成的原工作包可接纳。");
                workVersion=w.version();adopted=true;
            }else if(originalVersion!=null&&prior==null)workVersion=requireOpenWork(actor,c,target).version();
            else if(workVersion!=null){var w=requireOpenWork(actor,c,target);if(w.version()!=workVersion)throw conflict("原工作包版本已变化，请撤回此项调整后重新核对。");}
        }else if(input.existingWorkItemId()!=null)throw invalid("existingWorkItemId","仅工作包可接纳原工作记录。");
        if(originalVersion!=null&&s.changes.existsByCaseIdAndObjectIdAndStatus(c.id,target,"PENDING"))throw conflict("此对象还有待确认的单项变更，请先处理原提案。");
        if("BUDGET".equals(content.kind())&&previous==null&&b.objects().stream().anyMatch(o->"BUDGET".equals(o.kind())&&!o.archived()))throw conflict("请在本提案中修订原预算，不能重复新增。");
        rules.references(actor,c,b,content);required(input.reason(),"reason",2000);
        var proposed=new ObjectFact(target,previous==null?0:previous.version()+1,content.kind(),content,actor.accountId(),false,previous==null?0:previous.baselineVersion());
        var edit=new ObjectEdit(proposed,originalVersion,workVersion,adopted);replaceObject(d,edit);changed(d,actor);
        audit(c,d,actor,"OBJECT_EDITED","维护拟变更的"+DeliveryStore.label(content.kind())+"，原有效范围未修改。",input.reason());s.access.complete(res,id);return view(actor,c,d);
    }
    @Transactional View archiveObject(SessionPrincipal actor,UUID projectId,UUID id,UUID objectId,DeliveryCommands.ArchiveObject input){
        var c=manager(actor,projectId);var d=require(c,id);var res=s.access.reserve(actor,"dg2.sc.archive:"+s.codec.hash(List.of(id,objectId)),input.requestId(),input);
        if(res.replayed())return view(actor,c,d);version(d,input.version());editable(d);rules.requireFresh(actor,c,d,false);
        var o=findObject(rules.candidate(d),objectId);expected(o.version(),input.objectVersion());if(o.archived())throw conflict("此对象已经拟停用。");
        if("BUDGET".equals(o.kind()))throw conflict("预算通过修订原对象处理，不停用整份预算。");
        var prior=rules.draft(d).objects().stream().filter(e->e.proposed().id().equals(objectId)).findFirst().orElse(null);
        Long original=prior==null?Long.valueOf(o.version()):prior.originalVersion();if(original==null)throw conflict("新拟对象请撤回本项草案，无需停用。");
        Long workVersion="WORK_PACKAGE".equals(o.kind())?requireOpenWork(actor,c,objectId).version():null;
        if(prior!=null&&prior.workVersion()!=null&&!prior.workVersion().equals(workVersion))throw conflict("原工作包版本已变化，请撤回此项调整后重核。");
        required(input.reason(),"reason",2000);
        replaceObject(d,new ObjectEdit(new ObjectFact(o.id(),o.version()+1,o.kind(),o.content(),actor.accountId(),true,o.baselineVersion()),original,workVersion,false));
        changed(d,actor);audit(c,d,actor,"OBJECT_RETIRED","提案标记停用"+DeliveryStore.label(o.kind())+"，关联范围须一并补齐。",input.reason());s.access.complete(res,id);return view(actor,c,d);
    }
    @Transactional View saveResource(SessionPrincipal actor,UUID projectId,UUID id,UUID resourceId,ResourceSave input){
        var c=manager(actor,projectId);var d=require(c,id);var res=s.access.reserve(actor,"dg2.sc.resource:"+s.codec.hash(List.of(id.toString(),Objects.toString(resourceId,"new"))),input.requestId(),input);
        if(res.replayed())return view(actor,c,d);version(d,input.version());editable(d);rules.requireFresh(actor,c,d,false);
        var request=DeliveryRules.resource(input.request());var b=rules.candidate(d);rules.reference(b,request.workPackageId(),"WORK_PACKAGE");
        s.member(projectId,request.personId());s.member(projectId,request.committerId());s.requireCommitterOrganization(request);required(input.reason(),"reason",2000);
        var previous=resourceId==null?null:findResource(b,resourceId);
        var prior=rules.draft(d).resources().stream().filter(e->e.proposed().id().equals(resourceId)).findFirst().orElse(null);
        Long original=previous==null?null:prior==null?Long.valueOf(previous.version()):prior.originalVersion();
        if(previous!=null){expected(previous.version(),input.resourceVersion());if(!previous.request().workPackageId().equals(request.workPackageId()))throw invalid("workPackageId","原资源请求归属工作包不可改写，请撤回并新增请求。");}
        if(previous==null&&b.resources().size()>=300)throw conflict("当前候选资源超过 300 项，请先梳理请求。");
        if(input.releaseRequested()){
            if(original==null)throw conflict("新拟资源可以撤回草案，无需撤回正式承诺。");
            var initial=findResource(rules.base(d),resourceId);
            if("REVOKED".equals(initial.status())||!initial.request().equals(request))throw conflict("撤回请求须引用原有效资源安排，不能同时改写人选或投入。");
        }else if(s.work.completedPackageIds(projectId).contains(request.workPackageId()))throw conflict("已完成工作包不再新增或改写执行资源。");
        if(previous!=null&&previous.request().endsOn().isBefore(LocalDate.now()))throw conflict("已结束资源保留历史记录，请另建后续安排。");
        var proposed=new ResourceFact(resourceId==null?UUID.randomUUID():resourceId,previous==null?0:previous.version()+1,request,"REQUESTED",null,null,null,actor.accountId(),null);
        replaceResource(d,new ResourceEdit(proposed,original,input.releaseRequested()));changed(d,actor);
        audit(c,d,actor,"RESOURCE_EDITED","维护拟变更的资源安排，等待指定人签认。",input.reason());s.access.complete(res,id);return view(actor,c,d);
    }
    @Transactional View signResource(SessionPrincipal actor,UUID projectId,UUID id,UUID resourceId,DeliveryCommands.CommitResource input){
        var c=s.writable(actor,projectId,"DG2_RESOURCE_COMMIT");approved(c);var d=require(c,id);
        var res=s.access.reserve(actor,"dg2.sc.sign:"+s.codec.hash(List.of(id,resourceId)),input.requestId(),input);
        if(res.replayed())return view(actor,c,d);version(d,input.version());editable(d);rules.requireFresh(actor,c,d,false);
        var edit=rules.draft(d).resources().stream().filter(e->e.proposed().id().equals(resourceId)).findFirst().orElseThrow(BusinessRules::missing);
        var r=edit.proposed();expected(r.version(),input.resourceVersion());var request=r.request();
        if(!request.committerId().equals(actor.accountId()))throw conflict("请由此项拟安排指定的部门资源承诺人签认。");
        s.member(projectId,request.personId());s.requireCommitterOrganization(request);s.accounts.lockForResourceCommit(request.personId());
        String decision=choice(input.decision(),"decision","COMMITTED","CONFLICT","RESOLVED","REVOKED");required(input.reason(),"reason",2000);
        if(edit.releaseRequested()!= "REVOKED".equals(decision))throw conflict(edit.releaseRequested()?"此项为撤回原投入，请明确确认撤回。":"请先由经理提出资源撤回申请，再由指定人确认。");
        Commitment commitment=null;String hash=null;
        if(!edit.releaseRequested()){
            commitment=DeliveryRules.commitment(input.commitment());var b=rules.candidate(d);
            if("COMMITTED".equals(decision)&&rules.peak(b,r).compareTo(commitment.dailyCapacity())>0)throw conflict("整份提案的并行投入超过可用容量，请先记录冲突并协调。");
            if("RESOLVED".equals(decision)){
                if(!Set.of("CONFLICT","COMMITTED","RESOLVED").contains(r.status()))throw conflict("请先记录资源冲突，再填写协调结论。");
                required(commitment.impact(),"impact",4000);required(commitment.escalationPath(),"escalationPath",2000);
            }
            hash=rules.hash(b,r);
        }
        replaceResource(d,new ResourceEdit(new ResourceFact(r.id(),r.version()+1,request,decision,commitment,actor.accountId(),Instant.now(),r.preparedBy(),hash),edit.originalVersion(),edit.releaseRequested()));
        d.touch();changes.flush();audit(c,d,actor,"RESOURCE_SIGNED","指定人签认拟投入或撤回安排，当前正式容量尚未改变。",input.reason());s.access.complete(res,id);return view(actor,c,d);
    }
    List<Overlap> overlaps(SessionPrincipal actor,UUID projectId,UUID id,UUID resourceId){
        s.projects.requireReadable(actor,projectId,"DG2_READ");var c=s.require(projectId);var d=require(c,id);var b=rules.candidate(d);var r=findResource(b,resourceId);
        if(!List.of(c.managerId,r.request().personId(),r.request().committerId()).contains(actor.accountId()))throw conflict("资源明细仅供项目经理、资源人员与指定承诺人核验。");
        return rules.overlaps(actor,b,r);
    }
    @Transactional View action(SessionPrincipal actor,UUID projectId,UUID id,Action input){
        String action=choice(input.action(),"action","SUBMIT","APPROVE","RETURN","WITHDRAW","CANCEL","REBASE","REVERT_OBJECT","REVERT_RESOURCE");
        boolean decision=Set.of("APPROVE","RETURN").contains(action);
        var c=decision?s.writable(actor,projectId,"DG2_APPROVE"):manager(actor,projectId);approved(c);var d=require(c,id);
        var res=s.access.reserve(actor,"dg2.scope.action:"+id,input.requestId(),input);if(res.replayed())return view(actor,c,d);version(d,input.version());
        if(!OPEN.contains(d.status))throw conflict("此提案已有最终结果，历史不可覆盖。");
        String note=required(input.note(),"note",4000);
        if(decision){
            if(!"SUBMITTED".equals(d.status))throw conflict("请先提交完整提案，再办理独立决定。");budgetRead(actor,c);
            var round=current(d);var frozen=s.codec.read(round.frozenJson,Frozen.class);var policy=frozen.candidate().policy();
            if(policy==null||!actor.accountId().equals(policy.policy().finalApproverId())||actor.accountId().equals(d.createdBy)
                ||actor.accountId().equals(frozen.preparedBy())||actor.accountId().equals(round.submittedBy))throw conflict("须由规则指定、独立于本份提案准备者的公司授权人确认。");
            if("APPROVE".equals(action)){
                rules.requireFresh(actor,c,d,true);lockResources(rules.candidate(d));ready(actor,c,d);
                if(!round.snapshotHash.equals(s.codec.hash(frozen)))throw conflict("冻结提案校验失败，请退回核对。");
                apply(actor,c,d);d.status="APPROVED";round.baselineVersion=c.baselineVersion;
            }else d.status="RETURNED";
            round.status=d.status;round.decidedBy=actor.accountId();round.decidedAt=Instant.now();round.decisionNote=note;round.touch();submissions.flush();
        }else switch(action){
            case "SUBMIT"->{
                editable(d);s.projects.requireWritable(actor,projectId,"DG2_SUBMIT");budgetRead(actor,c);rules.requireFresh(actor,c,d,true);lockResources(rules.candidate(d));ready(actor,c,d);
                d.preparedBy=actor.accountId();var frozen=new Frozen(d.baseBaselineVersion,d.baseHash,rules.base(d),rules.candidate(d),rules.draft(d),d.reason,d.impact,d.basis,d.preparedBy);
                var round=new DeliveryScopeSubmission();round.changeId=id;round.number=submissions.findAllByChangeIdOrderByNumberDesc(id).size()+1;
                round.frozenJson=s.codec.write(frozen);round.snapshotHash=s.codec.hash(frozen);round.submittedBy=actor.accountId();submissions.saveAndFlush(round);
                d.currentSubmissionId=round.id;d.status="SUBMITTED";
            }
            case "CANCEL","WITHDRAW"->{
                if("WITHDRAW".equals(action)&&!"SUBMITTED".equals(d.status))throw conflict("只有已提交提案需要撤回。");
                if("SUBMITTED".equals(d.status)){var r=current(d);r.status="CANCEL".equals(action)?"CANCELLED":"WITHDRAWN";r.decidedBy=actor.accountId();r.decidedAt=Instant.now();r.decisionNote=note;r.touch();submissions.flush();}
                d.status="CANCEL".equals(action)?"CANCELLED":"DRAFT";
            }
            case "REBASE"->{editable(d);rebase(actor,c,d);}
            case "REVERT_OBJECT"->{editable(d);if(input.objectId()==null)throw invalid("objectId","请选择要撤回的草案项。");
                var old=rules.draft(d);var edit=old.objects().stream().filter(e->e.proposed().id().equals(input.objectId())).findFirst().orElseThrow(BusinessRules::missing);
                if("BUDGET".equals(edit.proposed().kind()))budgetEdit(actor,c);
                d.draftJson=s.codec.write(new Draft(old.objects().stream().filter(e->!e.proposed().id().equals(input.objectId())).toList(),old.resources()));d.preparedBy=actor.accountId();
            }
            case "REVERT_RESOURCE"->{editable(d);if(input.resourceId()==null)throw invalid("resourceId","请选择要撤回的资源草案。");
                var old=rules.draft(d);if(old.resources().stream().noneMatch(e->e.proposed().id().equals(input.resourceId())))throw BusinessRules.missing();
                d.draftJson=s.codec.write(new Draft(old.objects(),old.resources().stream().filter(e->!e.proposed().id().equals(input.resourceId())).toList()));d.preparedBy=actor.accountId();
            }
            default->throw invalid("action","未注册的提案操作。");
        }
        d.touch();changes.flush();audit(c,d,actor,action,"整组范围提案已"+switch(action){case "APPROVE"->"独立批准并形成 V"+c.baselineVersion+"。";case "RETURN"->"退回补齐，原轮次快照保留。";case "SUBMIT"->"冻结提交，当前批准范围继续执行。";case "REBASE"->"明确更新引用基线，保留无冲突草案。";case "CANCEL"->"取消，当前批准范围未改变。";case "WITHDRAW"->"撤回，原轮次快照保留。";default->"撤回所选草案项。";},note);
        s.access.complete(res,id);return view(actor,c,d);
    }
    private void ready(SessionPrincipal actor,DeliveryCase c,DeliveryScopeChange d){
        if(!c.managerId.equals(d.preparedBy)||!s.allowsPerson(d.preparedBy,"DG2_EDIT",c.projectId))throw conflict("本提案的项目经理责任或维护权限已变化，请重新核对引用依据。");
        if(rules.draft(d).objects().stream().anyMatch(e->"BUDGET".equals(e.proposed().kind()))
            &&!s.allowsPerson(d.preparedBy,"DELIVERY_BUDGET_EDIT",c.projectId))throw conflict("预算草案准备人的当前预算维护权限已失效。");
        if(rules.draft(d).objects().stream().anyMatch(e->"WORK_PACKAGE".equals(e.proposed().kind()))
            &&!s.allowsPerson(d.preparedBy,"WORK_EDIT",c.projectId))throw conflict("工作包草案准备人的当前工作维护权限已失效。");
        var problems=rules.problems(actor,c,d);if(!problems.isEmpty())throw conflict("请先补齐整组变更条件："+problems.getFirst());
        for(var e:rules.draft(d).objects())if(e.originalVersion()!=null&&s.changes.existsByCaseIdAndObjectIdAndStatus(c.id,e.proposed().id(),"PENDING"))throw conflict("涉及的原对象仍有待确认单项变更，请先处理。");
    }
    private void rebase(SessionPrincipal actor,DeliveryCase c,DeliveryScopeChange d){
        var live=s.snapshot(c);var draft=rules.draft(d);
        for(var e:draft.objects()){
            if(e.originalVersion()!=null){var current=findObject(live,e.proposed().id());if(current.version()!=e.originalVersion())throw conflict("请先撤回存在并发冲突的"+DeliveryStore.label(e.proposed().kind())+"草案，再更新引用依据。");}
            else if(s.objects.existsById(e.proposed().id()))throw conflict("新拟对象已进入正式范围，请先撤回此草案。");
            if(e.workVersion()!=null&&requireOpenWork(actor,c,e.proposed().id()).version()!=e.workVersion())throw conflict("原工作包已有新执行或责任，请先撤回该草案项。");
        }
        for(var e:draft.resources())if(e.originalVersion()!=null&&findResource(live,e.proposed().id()).version()!=e.originalVersion())throw conflict("原资源已有变化，请先撤回该资源草案。");
        captureBase(c,d);d.preparedBy=actor.accountId();
    }
    private void apply(SessionPrincipal actor,DeliveryCase c,DeliveryScopeChange d){
        int next=c.baselineVersion+1;var draft=rules.draft(d);
        for(var e:draft.objects()){
            var proposed=e.proposed();var o=e.originalVersion()==null?new DeliveryObject():s.object(c,proposed.id());
            if(e.originalVersion()==null&&s.objects.existsById(proposed.id()))throw conflict("预留对象标识已经进入正式范围。");
            if(e.originalVersion()!=null)expected(o.version,e.originalVersion());String before=e.originalVersion()==null?null:o.contentJson;
            if(proposed.content().workPackage()!=null){
                if(proposed.archived())s.work.setDeliveryState(c.projectId,List.of(proposed.id()),"RETIRED",next);
                else{var w=proposed.content().workPackage();s.work.approveDeliveryPackage(c.projectId,proposed.id(),e.workVersion(),w.title(),w.scope(),w.ownerId(),w.verifierId(),w.endsOn(),actor.accountId(),next);}
            }
            o.id=proposed.id();o.caseId=c.id;o.kind=proposed.kind();o.contentJson=s.codec.write(proposed.content());o.archived=proposed.archived();o.preparedBy=d.preparedBy;o.baselineVersion=next;o.touch();s.objects.saveAndFlush(o);
            boolean money="BUDGET".equals(o.kind);
            s.record(c,o.id,o.kind,o.version,before,o.contentJson,actor.accountId(),money?d.reason:"整组范围提案经独立批准后更新原对象。",money?d.impact:null,money?d.basis:null);
        }
        publisher.publishEvent(new com.winh.workplan.delivery.ApprovedDeliveryDirectory.BaselineApplied(c.projectId,
            draft.objects().stream().map(ObjectEdit::proposed).filter(o->!"BUDGET".equals(o.kind()))
                .map(o->new com.winh.workplan.delivery.ApprovedDeliveryDirectory.ObjectReference(o.id(),o.version(),o.kind(),o.content(),o.archived(),next)).toList(),next,actor.accountId()));
        for(var e:draft.resources()){
            var proposed=e.proposed();var request=proposed.request();var r=e.originalVersion()==null?new DeliveryResource():s.resources.findById(proposed.id()).filter(x->x.caseId.equals(c.id)).orElseThrow(BusinessRules::missing);
            if(e.originalVersion()==null&&s.resources.existsById(proposed.id()))throw conflict("预留资源标识已经进入正式安排。");
            if(e.originalVersion()!=null)expected(r.version,e.originalVersion());String before=e.originalVersion()==null?null:s.codec.write(s.resourceFact(r));
            r.id=proposed.id();r.caseId=c.id;r.projectId=c.projectId;r.workPackageId=request.workPackageId();r.personId=request.personId();r.committerId=request.committerId();
            r.startsOn=request.startsOn();r.endsOn=request.endsOn();r.dailyHours=request.dailyHours();r.requestJson=s.codec.write(request);r.status=proposed.status();
            r.commitmentJson=proposed.commitment()==null?null:s.codec.write(proposed.commitment());r.committedBy=proposed.committedBy();r.committedAt=proposed.committedAt();r.overlapHash=proposed.overlapHash();r.preparedBy=d.preparedBy;r.touch();s.resources.saveAndFlush(r);
            s.record(c,r.id,"RESOURCE",r.version,before,s.codec.write(s.resourceFact(r)),actor.accountId(),"整组范围提案经独立批准后应用指定人的签认安排。",null,null);
        }
        if(d.policyJson!=null){String before=c.policyJson;c.policyJson=d.policyJson;c.policyEditionId=s.codec.read(d.policyJson,PublishedConfiguration.class).id();s.record(c,c.id,"POLICY",c.version,before,c.policyJson,actor.accountId(),d.reason,d.impact,d.basis);}
        c.baselineVersion=next;s.touch(c);var snapshot=s.snapshot(c);var baseline=new DeliveryBaseline();baseline.caseId=c.id;baseline.baselineVersion=next;
        baseline.snapshotJson=s.codec.write(snapshot);baseline.snapshotHash=s.codec.hash(snapshot);baseline.approvedBy=actor.accountId();baseline.reason="整组范围变更经独立公司授权确认。";s.baselines.saveAndFlush(baseline);
    }
    private void lockResources(Snapshot b){b.resources().stream().map(r->r.request().personId()).distinct().sorted().forEach(s.accounts::lockForResourceCommit);}
    private DeliveryScopeSubmission current(DeliveryScopeChange d){return submissions.findById(d.currentSubmissionId).filter(r->r.changeId.equals(d.id)&&"SUBMITTED".equals(r.status)).orElseThrow(()->conflict("当前提案轮次已变化，请刷新重核。"));}
    private ResourceFact findResource(Snapshot b,UUID id){return b.resources().stream().filter(r->r.id().equals(id)).findFirst().orElseThrow(BusinessRules::missing);}
    private void metadata(SessionPrincipal actor,DeliveryCase c,DeliveryScopeChange d,Metadata input){
        d.reason=required(input.reason(),"reason",2000);d.impact=required(input.impact(),"impact",4000);d.basis=required(input.basis(),"basis",4000);
        if(input.policyEditionId()!=null){var p=s.configurations.requireSelectable(actor,c.projectId,input.policyEditionId(),"REVIEW_POLICY");d.policyJson=s.codec.write(p);}
        else d.policyJson=null;
    }
    private void captureBase(DeliveryCase c,DeliveryScopeChange d){var b=s.snapshot(c);d.baseBaselineVersion=c.baselineVersion;d.baseHash=rules.baseHash(c,b);d.baseSnapshotJson=s.codec.write(b);}
    private void replaceObject(DeliveryScopeChange d,ObjectEdit edit){var old=rules.draft(d);var objects=new ArrayList<>(old.objects().stream().filter(e->!e.proposed().id().equals(edit.proposed().id())).toList());objects.add(edit);d.draftJson=s.codec.write(new Draft(objects,old.resources()));}
    private void replaceResource(DeliveryScopeChange d,ResourceEdit edit){var old=rules.draft(d);var resources=new ArrayList<>(old.resources().stream().filter(e->!e.proposed().id().equals(edit.proposed().id())).toList());resources.add(edit);d.draftJson=s.codec.write(new Draft(old.objects(),resources));}
    private com.winh.workplan.work.WorkDirectory.WorkReference requireOpenWork(SessionPrincipal actor,DeliveryCase c,UUID id){var w=s.work.require(actor,c.projectId,id);if(!"OPEN".equals(w.status())||"RETIRED".equals(w.deliveryState()))throw conflict("已提交完成或已完成的工作包不能覆盖范围。");return w;}
    private DeliveryCase manager(SessionPrincipal actor,UUID projectId){var c=s.writable(actor,projectId,"DG2_EDIT");s.manager(actor,c);approved(c);return c;}
    private void approved(DeliveryCase c){if(!"APPROVED".equals(c.status))throw conflict("仅已批准的交付基线可建立后续范围提案。");}
    private DeliveryScopeChange require(DeliveryCase c,UUID id){return changes.findById(id).filter(d->d.caseId.equals(c.id)).orElseThrow(BusinessRules::missing);}
    private ObjectFact findObject(Snapshot b,UUID id){return b.objects().stream().filter(o->o.id().equals(id)).findFirst().orElseThrow(BusinessRules::missing);}
    private void editable(DeliveryScopeChange d){if(!Set.of("DRAFT","RETURNED").contains(d.status))throw conflict("提案已提交或结束，请先撤回或退回后修改。");}
    private void expected(long actual,Long expected){if(expected==null||expected!=actual)throw conflict("此项草案版本已变化，请刷新并核对后重新提交。");}
    private void budgetRead(SessionPrincipal actor,DeliveryCase c){s.projects.requireReadable(actor,c.projectId,"DELIVERY_BUDGET_READ");}
    private void budgetEdit(SessionPrincipal actor,DeliveryCase c){budgetRead(actor,c);s.projects.requireWritable(actor,c.projectId,"DELIVERY_BUDGET_EDIT");}
    private void changed(DeliveryScopeChange d,SessionPrincipal actor){d.preparedBy=actor.accountId();d.touch();changes.flush();}
    private void audit(DeliveryCase c,DeliveryScopeChange d,SessionPrincipal actor,String action,String text,String note){
        var event=new DeliveryScopeEvent();event.changeId=d.id;event.action=action;event.actorId=actor.accountId();event.note=required(note,"note",4000);events.saveAndFlush(event);
        s.history.record(c.id,"DELIVERY_INITIATION","DELIVERY_SCOPE_"+action,text,actor.accountId());
    }
    private DeliveryScopes.Row row(DeliveryCase c,DeliveryScopeChange d,boolean money){var e=rules.draft(d);return new DeliveryScopes.Row(d.id,d.version,d.status,d.baseBaselineVersion,
        OPEN.contains(d.status)&&!d.baseHash.equals(rules.baseHash(c,s.snapshot(c))),e.objects().size(),e.resources().size(),d.createdBy,d.preparedBy,d.createdAt,d.updatedAt,money?d.reason:null);}
    private Draft projectDraft(Draft draft,boolean money){return new Draft(draft.objects().stream().filter(e->money||!"BUDGET".equals(e.proposed().kind())).toList(),draft.resources());}
    private View view(SessionPrincipal actor,DeliveryCase c,DeliveryScopeChange d){
        var p=s.projects.requireReadable(actor,c.projectId,"DG2_READ");boolean money=s.allows(actor,p,"DELIVERY_BUDGET_READ");
        var b=rules.candidate(d);var allowed=new ArrayList<String>();boolean open=OPEN.contains(d.status),edit=Set.of("DRAFT","RETURNED").contains(d.status);
        boolean manager=c.managerId.equals(actor.accountId())&&s.allows(actor,p,"DG2_EDIT")&&!"CLOSED".equals(p.status());
        if(open&&!"CLOSED".equals(p.status())){
            if(manager){allowed.add("CANCEL");if(edit){allowed.add("EDIT");allowed.add("REBASE");if(money&&s.allows(actor,p,"DG2_SUBMIT"))allowed.add("SUBMIT");if(money&&s.allows(actor,p,"DELIVERY_BUDGET_EDIT"))allowed.add("EDIT_BUDGET");}else allowed.add("WITHDRAW");}
            if(edit&&s.allows(actor,p,"DG2_RESOURCE_COMMIT"))allowed.add("SIGN_RESOURCES");
            if("SUBMITTED".equals(d.status)&&money&&s.allows(actor,p,"DG2_APPROVE")&&b.policy()!=null&&actor.accountId().equals(b.policy().policy().finalApproverId())
                &&!actor.accountId().equals(d.createdBy)&&!actor.accountId().equals(d.preparedBy))allowed.add("DECIDE");
        }
        var stale=open?rules.staleProblems(actor,c,d,s.allows(actor,p,"WORK_READ")):List.<String>of();
        var problems=open?(money?rules.problems(actor,c,d):List.of("本提案涉及实施预算，完整条件请由有预算阅读权的人员核验。")):List.<String>of();
        var rounds=submissions.findAllByChangeIdOrderByNumberDesc(d.id).stream().map(r->new DeliveryScopes.Round(r.id,r.version,r.number,r.status,r.snapshotHash,r.submittedBy,r.createdAt,r.decidedBy,r.decidedAt,money?r.decisionNote:null,r.baselineVersion)).toList();
        return new View(row(c,d,money),s.projectSnapshot(rules.base(d),money),s.projectSnapshot(b,money),projectDraft(rules.draft(d),money),money,b.policy()==null?null:b.policy().policy().finalApproverId(),
            money?d.impact:null,money?d.basis:null,d.policyJson==null?null:s.codec.read(d.policyJson,PublishedConfiguration.class).id(),problems,stale,rounds,
            events.findTop100ByChangeIdOrderByCreatedAtDesc(d.id).stream().map(e->new ChangeEvent(e.id,e.action,e.actorId,e.createdAt,money?e.note:null)).toList(),allowed);
    }
}
