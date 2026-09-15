package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.delivery.baseline.DeliveryCommands.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
class DeliveryReviewService {
    private final DeliveryStore s;
    private final DeliveryPreparationService preparation;
    DeliveryReviewService(DeliveryStore s,DeliveryPreparationService preparation){this.s=s;this.preparation=preparation;}
    Workspace submit(SessionPrincipal actor,UUID projectId,Submit input){
        var c=s.writable(actor,projectId,"DG2_SUBMIT");s.manager(actor,c);
        var res=s.access.reserve(actor,"delivery.submit:"+c.id,input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());s.editable(c);
        if("APPROVED".equals(c.status))throw conflict("项目已形成批准基线，后续调整请维护原对象版本。");
        String note=required(input.note(),"note",4000);lockResources(c);requireReady(actor,c);
        var snapshot=s.snapshot(c);var policy=snapshot.policy().policy();
        if(s.preparers(snapshot).contains(policy.finalApproverId())||policy.finalApproverId().equals(actor.accountId()))throw conflict("最终批准人须独立于申报准备者与提交人。");
        var r=new DeliveryRound();r.caseId=c.id;r.roundNumber=++c.roundNumber;r.snapshotJson=s.codec.write(snapshot);
        r.snapshotHash=s.codec.hash(snapshot);r.submittedBy=actor.accountId();r.submissionNote=note;s.rounds.saveAndFlush(r);
        for(var configured:policy.reviewers()){
            if(configured.accountId().equals(actor.accountId()))throw conflict("提交人不能会签自己的申报。");
            var review=new DeliveryReview();review.roundId=r.id;review.reviewerId=configured.accountId();review.scope=configured.scope();s.reviews.save(review);
        }
        s.reviews.flush();c.currentRoundId=r.id;c.status="SUBMITTED";s.touch(c);setWorkState(c,"IN_REVIEW",0);
        s.history.record(c.id,"DELIVERY_INITIATION","DG02_SUBMITTED","提交第 "+r.roundNumber+" 轮评审，已冻结本轮对象快照。",actor.accountId());
        s.access.complete(res,r.id);return s.workspace(actor,projectId);
    }
    Workspace review(SessionPrincipal actor,UUID projectId,UUID roundId,Decision input){
        var c=s.writable(actor,projectId,"DG2_REVIEW");
        var res=s.access.reserve(actor,"delivery.review:"+roundId,input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());var r=current(c,roundId,input.roundVersion());
        var snapshot=s.codec.read(r.snapshotJson,Snapshot.class);independent(actor,r,snapshot);
        var mine=s.reviews.findAllByRoundIdOrderByCreatedAtAsc(r.id).stream().filter(v->v.reviewerId.equals(actor.accountId())).findFirst()
            .orElseThrow(()->conflict("当前账号不是本轮指定会签人。"));
        if(!"PENDING".equals(mine.status))throw conflict("本范围已提交意见；补充或变更请退回重新评审。");
        String decision=choice(input.decision(),"decision","AGREED","RETURNED");String comment=required(input.comment(),"comment",4000);
        if("FINANCIAL".equals(mine.scope))s.projects.requireReadable(actor,projectId,"DELIVERY_BUDGET_READ");
        mine.status=decision;mine.comment=comment;mine.reviewedAt=Instant.now();mine.touch();s.reviews.flush();
        if("RETURNED".equals(decision))finishReturned(c,r,actor.accountId(),comment,"RETURNED");
        else{r.status="IN_REVIEW";r.touch();s.rounds.flush();c.status="IN_REVIEW";s.touch(c);}
        s.history.record(c.id,"DELIVERY_INITIATION","DG02_REVIEW_"+decision,"第 "+r.roundNumber+" 轮 "+mine.scope+" 会签："+("AGREED".equals(decision)?"同意。":"退回补齐。"),actor.accountId());
        s.access.complete(res,mine.id);return s.workspace(actor,projectId);
    }
    Workspace decide(SessionPrincipal actor,UUID projectId,UUID roundId,Decision input){
        var c=s.writable(actor,projectId,"DG2_APPROVE");
        var res=s.access.reserve(actor,"delivery.decide:"+roundId,input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());var r=current(c,roundId,input.roundVersion());
        var frozen=s.codec.read(r.snapshotJson,Snapshot.class);independent(actor,r,frozen);
        if(!actor.accountId().equals(frozen.policy().policy().finalApproverId()))throw conflict("请由本轮规则指定的最终批准人处理。");
        String decision=choice(input.decision(),"decision","APPROVED","RETURNED");String comment=required(input.comment(),"comment",4000);
        if("RETURNED".equals(decision))finishReturned(c,r,actor.accountId(),comment,"RETURNED");
        else{
            if(s.reviews.findAllByRoundIdOrderByCreatedAtAsc(r.id).stream().anyMatch(v->!"AGREED".equals(v.status)))throw conflict("请先完成全部必要会签。");
            lockResources(c);requireReady(actor,c);
            if(!s.contentHash(frozen).equals(s.contentHash(s.snapshot(c))))throw conflict("当前准备内容与本轮冻结快照不一致，请退回后重新提交。");
            r.status="APPROVED";r.decidedBy=actor.accountId();r.decidedAt=Instant.now();r.decisionNote=comment;r.touch();s.rounds.flush();
            c.status="APPROVED";c.baselineVersion=1;s.touch(c);
            for(var o:s.objects.findAllByCaseIdOrderByCreatedAtAsc(c.id))if(!o.archived){o.baselineVersion=1;o.touch();}s.objects.flush();
            setWorkState(c,"BASELINED",1);var approved=s.snapshot(c);
            var baseline=new DeliveryBaseline();baseline.caseId=c.id;baseline.roundId=r.id;baseline.baselineVersion=1;
            baseline.snapshotJson=s.codec.write(approved);baseline.snapshotHash=s.codec.hash(approved);baseline.approvedBy=actor.accountId();
            baseline.reason="DG-02 第 "+r.roundNumber+" 轮独立评审批准原对象 V1。";s.baselines.saveAndFlush(baseline);
            s.projects.activateDelivery(projectId,actor.accountId(),baseline.id);
        }
        s.history.record(c.id,"DELIVERY_INITIATION","DG02_"+decision,"第 "+r.roundNumber+" 轮最终决定："+("APPROVED".equals(decision)?"通过并形成原项目 V1。":"退回补齐。"),actor.accountId());
        s.access.complete(res,r.id);return s.workspace(actor,projectId);
    }
    Workspace withdraw(SessionPrincipal actor,UUID projectId,UUID roundId,Decision input){
        var c=s.writable(actor,projectId,"DG2_SUBMIT");var res=s.access.reserve(actor,"delivery.withdraw:"+roundId,input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());var r=current(c,roundId,input.roundVersion());
        if(!r.submittedBy.equals(actor.accountId()))throw conflict("仅本轮提交人可撤回自己的申报。");
        String comment=required(input.comment(),"comment",4000);finishReturned(c,r,actor.accountId(),comment,"WITHDRAWN");
        s.history.record(c.id,"DELIVERY_INITIATION","DG02_WITHDRAWN","撤回第 "+r.roundNumber+" 轮；原快照和意见保留。",actor.accountId());
        s.access.complete(res,r.id);return s.workspace(actor,projectId);
    }
    Workspace decideChange(SessionPrincipal actor,UUID projectId,UUID changeId,DecideChange input){
        s.projects.requireReadable(actor,projectId,"DELIVERY_BUDGET_READ");
        var c=s.writable(actor,projectId,"DG2_APPROVE");var res=s.access.reserve(actor,"delivery.change:"+changeId,input.requestId(),input);
        if(res.replayed())return s.workspace(actor,projectId);version(c,input.version());s.editable(c);
        if(!"APPROVED".equals(c.status))throw conflict("仅已批准基线可办理范围变更。");
        var change=s.changes.findById(changeId).filter(x->x.caseId.equals(c.id)).orElseThrow(BusinessRules::missing);version(change,input.changeVersion());
        if(!"PENDING".equals(change.status))throw conflict("此变更已有明确结论。");
        var policy=s.snapshot(c).policy().policy();
        if(!actor.accountId().equals(policy.finalApproverId())||actor.accountId().equals(change.submittedBy))throw conflict("范围变更须由指定的独立公司授权人确认。");
        String decision=choice(input.decision(),"decision","APPROVED","RETURNED");String comment=required(input.comment(),"comment",4000);
        if("APPROVED".equals(decision)){
            var object=s.object(c,change.objectId);version(object,change.expectedObjectVersion);String before=object.contentJson;
            var content=DeliveryRules.content(s.codec.read(change.contentJson,DeliveryContent.Content.class));
            s.validateReferences(actor,c,content);object.contentJson=change.contentJson;object.archived=change.archiveRequested;object.preparedBy=change.submittedBy;object.touch();s.objects.flush();
            lockResources(c);preparation.validateCurrentStructure(c);
            if(content.workPackage()!=null&&!change.archiveRequested){var w=content.workPackage();s.work.reviseDeliveryPackage(projectId,object.id,w.title(),w.scope(),w.ownerId(),w.verifierId(),w.endsOn(),actor.accountId());}
            preparation.publishRevision(c,actor.accountId(),"范围变更经独立授权确认生效。",object);
            s.record(c,object.id,object.kind,object.version,before,object.contentJson,actor.accountId(),change.reason,change.impact,change.basis);
        }
        change.status=decision;change.decidedBy=actor.accountId();change.decidedAt=Instant.now();change.decision=comment;change.touch();s.changes.flush();s.touch(c);
        s.history.record(c.id,"DELIVERY_INITIATION","DELIVERY_CHANGE_"+decision,"范围变更已由独立授权人"+("APPROVED".equals(decision)?"确认生效。":"退回。"),actor.accountId());
        s.access.complete(res,change.id);return s.workspace(actor,projectId);
    }
    private DeliveryRound current(DeliveryCase c,UUID id,Long expected){
        if(!s.frozen(c)||!id.equals(c.currentRoundId))throw conflict("请处理当前正在评审的轮次。");
        var r=s.rounds.findById(id).filter(x->x.caseId.equals(c.id)).orElseThrow(BusinessRules::missing);version(r,expected);return r;
    }
    private void independent(SessionPrincipal actor,DeliveryRound r,Snapshot frozen){
        if(r.submittedBy.equals(actor.accountId())||s.preparers(frozen).contains(actor.accountId()))throw conflict("提交人或本轮申报内容的准备者不能审批自己的申报。");
    }
    private void requireReady(SessionPrincipal actor,DeliveryCase c){
        var blocked=s.checks(actor,c).stream().filter(check->!"PASS".equals(check.status())).toList();
        if(!blocked.isEmpty())throw conflict("请先处理立项条件："+blocked.getFirst().title()+"；"+String.join("；",blocked.getFirst().problems()));
    }
    private void finishReturned(DeliveryCase c,DeliveryRound r,UUID actorId,String comment,String status){
        r.status=status;r.decidedBy=actorId;r.decidedAt=Instant.now();r.decisionNote=comment;r.touch();s.rounds.flush();
        c.status=status;s.touch(c);setWorkState(c,"PREPARING",0);
    }
    private void setWorkState(DeliveryCase c,String state,int baseline){
        var ids=s.objects.findAllByCaseIdOrderByCreatedAtAsc(c.id).stream().filter(o->!o.archived&&"WORK_PACKAGE".equals(o.kind)).map(o->o.id).toList();
        s.work.setDeliveryState(c.projectId,ids,state,baseline);
    }
    private void lockResources(DeliveryCase c){
        s.resources.findAllByCaseIdOrderByCreatedAtAsc(c.id).stream().filter(r->!"REVOKED".equals(r.status)).map(r->r.personId).distinct().sorted().forEach(s.accounts::lockForResourceCommit);
    }
}
