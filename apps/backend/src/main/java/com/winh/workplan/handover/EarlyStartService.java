package com.winh.workplan.handover;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.handover.EarlyStartCommands.*;
import static com.winh.workplan.handover.EarlyStartViews.*;
import com.winh.workplan.business.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.project.ProjectDirectory;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
public class EarlyStartService implements EarlyStartDirectory {
    private final EarlyStartApplicationRepository applications;
    private final EarlyStartReviewRepository reviews;
    private final EarlyStartLedgerRepository ledger;
    private final EarlyClosureAllowanceRepository allowances;
    private final ProjectDirectory projects;
    private final BusinessAccess access;
    private final BusinessHistory history;
    private final ReviewSnapshot snapshots;
    EarlyStartService(EarlyStartApplicationRepository applications, EarlyStartReviewRepository reviews,
            EarlyStartLedgerRepository ledger, EarlyClosureAllowanceRepository allowances, ProjectDirectory projects,
            BusinessAccess access, BusinessHistory history, ReviewSnapshot snapshots) {
        this.applications=applications;this.reviews=reviews;this.ledger=ledger;this.allowances=allowances;
        this.projects=projects;this.access=access;this.history=history;this.snapshots=snapshots;
    }
    public Workspace workspace(SessionPrincipal actor,UUID projectId) {
        var ctx=projects.requireReadable(actor,projectId,"EARLY_START_READ");
        var apps=applications.findAllByProjectIdOrderByCreatedAtDesc(projectId);
        boolean visible=access.allows(actor,"EARLY_LEDGER_READ",ctx.authorization());
        return new Workspace(apps.stream().map(this::view).toList(),apps.stream().flatMap(a->reviews.findAllByApplicationIdOrderByCreatedAtDesc(a.id).stream()).map(this::view).toList(),
            visible?apps.stream().flatMap(a->ledger.findAllByApplicationIdOrderByCreatedAtDesc(a.id).stream()).map(this::view).toList():List.of(),
            apps.stream().flatMap(a->allowances.findAllByApplicationIdOrderByCreatedAtDesc(a.id).stream()).map(this::view).toList(),visible,
            apps.stream().flatMap(a->history.list(a.id).stream()).sorted(Comparator.comparing(BusinessHistory.EventView::createdAt).reversed()).toList(),
            "CLOSED".equals(ctx.status())?List.of():access.actions(actor,ctx.authorization(),"EARLY_START_EDIT","EARLY_START_REVIEW","EARLY_LEDGER_READ","EARLY_LEDGER_EDIT"));
    }
    @Transactional
    public Workspace save(SessionPrincipal actor,UUID projectId,UUID id,ApplicationInput input) {
        var ctx=projects.requireWritable(actor,projectId,"EARLY_START_EDIT");
        if(!"PRESALES".equals(ctx.mainStage()))throw conflict("已进入交付，请使用正式项目基线处理新增投入。");
        var res=access.reserve(actor,id==null?"es.create:"+projectId:"es.edit:"+id,input.requestId(),input);
        if(res.replayed())return workspace(actor,projectId);
        var a=id==null?new EarlyStartApplication():application(projectId,id);
        if(id!=null){version(a,input.version());editable(a);}
        a.projectId=projectId;if(id==null)a.createdBy=actor.accountId();
        a.title=required(input.title(),"title",160);a.scope=required(input.scope(),"scope",4000);
        if(input.scopeItems()==null||input.scopeItems().isEmpty()||input.scopeItems().size()>20)throw invalid("scopeItems","请填写 1–20 个明确的批准范围条目。");
        var scopes=input.scopeItems().stream().map(s->required(s,"scopeItems",160)).distinct().toList();
        if(scopes.stream().anyMatch(s->s.contains("\n")||s.contains("\r")))throw invalid("scopeItems","每项范围须单独填写，不包含换行。");
        a.scopeItems=String.join("\n",scopes);a.requestedHours=amount(input.requestedHours(),"requestedHours");a.requestedCost=amount(input.requestedCost(),"requestedCost");
        nonzero(a.requestedHours,a.requestedCost);dates(input.startsOn(),input.endsOn());a.startsOn=input.startsOn();a.endsOn=input.endsOn();
        member(projectId,input.riskOwnerId());a.riskOwnerId=input.riskOwnerId();
        a.stopConditions=required(input.stopConditions(),"stopConditions",4000);a.missingItems=required(input.missingItems(),"missingItems",4000);
        a.regularizationPlan=required(input.regularizationPlan(),"regularizationPlan",4000);a.status="DRAFT";a.touch();applications.saveAndFlush(a);
        history.record(a.id,"EARLY_START","EARLY_START_SAVED","维护提前开工申请，待独立授权。",actor.accountId());access.complete(res,a.id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace submit(SessionPrincipal actor,UUID projectId,UUID id,Submit input) {
        projects.requireWritable(actor,projectId,"EARLY_START_EDIT");var a=application(projectId,id);
        var res=access.reserve(actor,"es.submit:"+id,input.requestId(),input);if(res.replayed())return workspace(actor,projectId);
        version(a,input.version());editable(a);member(projectId,a.riskOwnerId);
        if(a.endsOn.isBefore(LocalDate.now()))throw conflict("申请期限已过，请更新期限。");
        a.status="SUBMITTED";a.submittedBy=actor.accountId();a.touch();applications.flush();
        var r=new EarlyStartReview();r.applicationId=id;r.submittedBy=actor.accountId();r.snapshot=snapshots.json(facts(a));r.snapshotHash=snapshots.hash(facts(a));reviews.saveAndFlush(r);
        history.record(id,"EARLY_START","EARLY_START_SUBMITTED","提交提前开工申请并保存当轮范围快照。",actor.accountId());access.complete(res,id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace review(SessionPrincipal actor,UUID projectId,UUID id,UUID reviewId,Review input) {
        projects.requireWritable(actor,projectId,"EARLY_START_REVIEW");var a=application(projectId,id);
        var res=access.reserve(actor,"es.review:"+reviewId,input.requestId(),input);if(res.replayed())return workspace(actor,projectId);
        var r=reviews.findById(reviewId).filter(x->x.applicationId.equals(id)).orElseThrow(BusinessRules::missing);version(r,input.version());
        if(!"SUBMITTED".equals(r.status)||!"SUBMITTED".equals(a.status))throw conflict("此申请不在待复核状态。");
        independent(actor,projectId,r.submittedBy);String decision=choice(input.decision(),"decision","APPROVED","RETURNED");
        if("APPROVED".equals(decision)) {
            if(a.endsOn.isBefore(LocalDate.now())||!r.snapshotHash.equals(snapshots.hash(facts(a))))throw conflict("申请已过期或内容变化，请退回后重提。");
            member(projectId,a.riskOwnerId);
            if(applications.findAllByProjectIdOrderByCreatedAtDesc(projectId).stream().anyMatch(x->!x.id.equals(id)&&"APPROVED".equals(x.status)))throw conflict("项目已有未关闭的提前开工授权，请先处理原授权及承诺。");
            a.approvedHours=amount(input.approvedHours()==null?a.requestedHours:input.approvedHours(),"approvedHours");a.approvedCost=amount(input.approvedCost()==null?a.requestedCost:input.approvedCost(),"approvedCost");nonzero(a.approvedHours,a.approvedCost);
            if(a.approvedHours.compareTo(a.requestedHours)>0||a.approvedCost.compareTo(a.requestedCost)>0)throw invalid("approvedHours","批准额度不能高于申请额度。");
            a.approvedBy=actor.accountId();a.approvedAt=Instant.now();projects.activate(projectId);
        }
        r.status=decision;r.reviewComment=required(input.comment(),"comment",2000);r.reviewedBy=actor.accountId();r.reviewedAt=Instant.now();r.touch();a.status=decision;a.touch();reviews.flush();applications.flush();
        history.record(id,"EARLY_START","EARLY_START_"+decision,"提前开工独立复核："+r.reviewComment,actor.accountId());access.complete(res,id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace record(SessionPrincipal actor,UUID projectId,UUID id,LedgerInput input) {
        var ctx=projects.requireWritable(actor,projectId,"EARLY_LEDGER_EDIT");access.require(actor,"EARLY_LEDGER_READ",ctx.authorization());var a=application(projectId,id);
        var res=access.reserve(actor,"es.ledger:"+id,input.requestId(),input);if(res.replayed())return workspace(actor,projectId);
        if(a.approvedBy==null||!Set.of("APPROVED","CLOSED","REGULARIZED").contains(a.status))throw conflict("提前开工尚未批准。");
        var all=ledger.findAllByApplicationIdOrderByCreatedAtDesc(id);var e=new EarlyStartLedger();e.applicationId=id;e.createdBy=actor.accountId();
        e.kind=choice(input.kind(),"kind","COMMITTED","ACTUAL","REVERSAL");e.evidence=required(input.evidence(),"evidence",4000);
        if("REVERSAL".equals(e.kind)) {
            var original=all.stream().filter(x->x.id.equals(input.reversesId())).findFirst().orElseThrow(()->invalid("reversesId","请选择本申请的原记录。"));
            if(original.reversed||"REVERSAL".equals(original.kind))throw conflict("原记录已冲正或不支持冲正。");
            if(all.stream().anyMatch(x->original.id.equals(x.commitmentId)&&!x.reversed&&"ACTUAL".equals(x.kind)))throw conflict("此承诺已被核销，请先冲正关联实际记录。");
            original.reversed=true;original.touch();e.reversesId=original.id;e.commitmentType=original.commitmentType;e.scopeItem=original.scopeItem;e.ownerId=original.ownerId;
            e.allowanceId=original.allowanceId;e.hours=original.hours.negate();e.cost=original.cost.negate();e.occurredOn=LocalDate.now();
        } else {
            e.commitmentType=choice(input.commitmentType(),"commitmentType","LABOR","PROCUREMENT","SUBCONTRACT","OTHER");
            e.scopeItem=required(input.scopeItem(),"scopeItem",160);scope(a,e.scopeItem);member(projectId,input.ownerId());e.ownerId=input.ownerId();
            e.hours=amount(input.hours(),"hours");e.cost=amount(input.cost(),"cost");nonzero(e.hours,e.cost);e.occurredOn=input.occurredOn();
            if(e.occurredOn==null||e.occurredOn.isAfter(LocalDate.now()))throw invalid("occurredOn","请填写不晚于今天的实际发生日期。");
            e.allowanceId=input.allowanceId();
            if(input.commitmentId()!=null) {
                if(!"ACTUAL".equals(e.kind))throw invalid("commitmentId","仅实际发生可以核销承诺。");
                var commitment=all.stream().filter(x->x.id.equals(input.commitmentId())&&"COMMITTED".equals(x.kind)&&!x.reversed).findFirst().orElseThrow(()->invalid("commitmentId","请选择本申请的有效承诺。"));
                if(!commitment.scopeItem.equals(e.scopeItem)||!commitment.commitmentType.equals(e.commitmentType))throw invalid("scopeItem","核销须沿用原承诺的范围与类型。");
                if(e.occurredOn.isBefore(commitment.occurredOn))throw invalid("occurredOn","实际发生不能早于原承诺日期。");
                BigDecimal paidH=BigDecimal.ZERO,paidC=BigDecimal.ZERO;
                for(var x:all)if(commitment.id.equals(x.commitmentId)&&!x.reversed&&"ACTUAL".equals(x.kind)){paidH=paidH.add(x.hours);paidC=paidC.add(x.cost);}
                if(paidH.add(e.hours).compareTo(commitment.hours)>0||paidC.add(e.cost).compareTo(commitment.cost)>0)throw invalid("commitmentId","实际核销超过原承诺未核销额度。");
                if(input.allowanceId()!=null&&!input.allowanceId().equals(commitment.allowanceId))throw invalid("allowanceId","核销不能更换原承诺的安全收尾授权。");
                e.commitmentId=commitment.id;e.allowanceId=commitment.allowanceId;
            }
            var allowance=e.allowanceId==null?null:allowance(id,e.allowanceId);
            LocalDate from=allowance==null?a.startsOn:allowance.startsOn,to=allowance==null?a.endsOn:allowance.endsOn;
            if(e.occurredOn.isBefore(from)||e.occurredOn.isAfter(to))throw invalid("occurredOn","发生日期须位于对应批准期限内。");
            if(allowance!=null&&!allowance.scopeItem.equals(e.scopeItem))throw invalid("scopeItem","本次安全收尾授权不覆盖所选范围。");
            var combined=new ArrayList<>(all);combined.add(e);
            if("ACTUAL".equals(e.kind)&&over(totals(combined.stream().filter(x->Objects.equals(x.allowanceId,e.allowanceId)).toList()),allowance==null?a.approvedHours:allowance.hours,allowance==null?a.approvedCost:allowance.cost)) {
                var reason=required(input.overrunReason(),"overrunReason",1000);
                e.evidence=required(e.evidence+"\n超限原因："+reason,"evidence",4000);
            }
            if("COMMITTED".equals(e.kind)) {
                if("REGULARIZED".equals(a.status))throw conflict("申请已转正，不再新增临时承诺。");
                if(allowance==null&&!"ACTIVE".equals(effective(a,totals(all.stream().filter(x->x.allowanceId==null).toList()))))throw conflict("普通授权已停止、到期、未开始或超限，不能新增承诺。");
                if(LocalDate.now().isBefore(from)||LocalDate.now().isAfter(to))throw conflict("批准期限之外不能新增承诺。");
                var used=totals(combined.stream().filter(x->Objects.equals(x.allowanceId,e.allowanceId)).toList());
                if(over(used,allowance==null?a.approvedHours:allowance.hours,allowance==null?a.approvedCost:allowance.cost))throw conflict("新增承诺将超过对应批准上限，请先取得授权。");
            }
        }
        ledger.saveAndFlush(e);
        boolean overrun=over(totals(ledger.findAllByApplicationIdOrderByCreatedAtDesc(id).stream().filter(x->x.allowanceId==null).toList()),a.approvedHours,a.approvedCost);
        history.record(id,"EARLY_START",overrun?"EARLY_START_OVER_LIMIT":"EARLY_LEDGER_RECORDED",overrun?"实际占用已超过普通授权，停止新增普通承诺并提交管理处理。":"登记提前开工台账；明细与依据按独立权限查看。",actor.accountId());
        access.complete(res,e.id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace authorizeClosure(SessionPrincipal actor,UUID projectId,UUID id,AllowanceInput input) {
        projects.requireWritable(actor,projectId,"EARLY_START_REVIEW");var a=application(projectId,id);
        var res=access.reserve(actor,"es.allow:"+id,input.requestId(),input);if(res.replayed())return workspace(actor,projectId);
        version(a,input.version());if(!Set.of("APPROVED","CLOSED").contains(a.status))throw conflict("仅已批准或已停止的申请可授权安全收尾。");
        independent(actor,projectId,a.submittedBy);var c=new EarlyClosureAllowance();c.applicationId=id;c.scopeItem=required(input.scopeItem(),"scopeItem",160);scope(a,c.scopeItem);
        c.hours=amount(input.hours(),"hours");c.cost=amount(input.cost(),"cost");nonzero(c.hours,c.cost);dates(input.startsOn(),input.endsOn());
        if(input.endsOn().isBefore(LocalDate.now())||input.endsOn().isAfter(input.startsOn().plusDays(30)))throw invalid("endsOn","安全收尾须为未过期、最长 30 天的明确期限。");
        c.startsOn=input.startsOn();c.endsOn=input.endsOn();c.reason=required(input.reason(),"reason",4000);c.approvedBy=actor.accountId();allowances.saveAndFlush(c);a.touch();applications.flush();
        history.record(id,"EARLY_START","EARLY_CLOSURE_AUTHORIZED","独立授权原范围内的安全止损与收尾，另设限额及期限。",actor.accountId());access.complete(res,c.id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace close(SessionPrincipal actor,UUID projectId,UUID id,Finish input) {
        projects.requireWritable(actor,projectId,"EARLY_START_REVIEW");var a=application(projectId,id);
        var res=access.reserve(actor,"es.close:"+id,input.requestId(),input);if(res.replayed())return workspace(actor,projectId);
        version(a,input.version());independent(actor,projectId,a.submittedBy==null?a.createdBy:a.submittedBy);
        if(!Set.of("APPROVED","DRAFT","RETURNED").contains(a.status))throw conflict("当前状态不能关闭。");
        a.status="CLOSED";a.finishReason=required(input.reason(),"reason",2000);a.touch();applications.flush();
        history.record(id,"EARLY_START","EARLY_START_STOPPED","停止新增普通承诺，原台账保留；"+a.finishReason,actor.accountId());access.complete(res,id);return workspace(actor,projectId);
    }
    @Override @Transactional(readOnly=true,noRollbackFor=com.winh.workplan.iam.shared.DomainException.class)
    public ApprovalReference requireEffective(SessionPrincipal actor,UUID projectId,UUID id) {
        projects.requireReadable(actor,projectId,"EARLY_START_READ");if(id==null)throw invalid("referenceId","请选择提前开工申请。");var a=application(projectId,id);
        if(!"ACTIVE".equals(effective(a,totals(ledger.findAllByApplicationIdOrderByCreatedAtDesc(id).stream().filter(x->x.allowanceId==null).toList()))))throw conflict("提前开工不在有效范围和期限内。");
        member(projectId,a.riskOwnerId);return new ApprovalReference(a.id,a.version,a.title,a.startsOn.toString(),a.endsOn.toString());
    }
    @Override @Transactional public void regularize(SessionPrincipal actor,UUID projectId,UUID id,UUID packageId,Finish input) {
        projects.requireWritable(actor,projectId,"EARLY_START_EDIT");var a=application(projectId,id);
        var res=access.reserve(actor,"es.regular:"+id,input.requestId(),List.of(packageId,input));if(res.replayed())return;
        version(a,input.version());if(a.approvedBy==null||!Set.of("APPROVED","CLOSED").contains(a.status))throw conflict("当前申请不能转正。");
        a.status="REGULARIZED";a.regularizationPackageId=packageId;a.finishReason=required(input.reason(),"reason",2000);a.touch();applications.flush();
        history.record(id,"EARLY_START","EARLY_START_REGULARIZED","已关联正常商务依据的 DG-01 移交包；DG-02 仍需独立完成。",actor.accountId());access.complete(res,id);
    }
    @EventListener public void preventRemoval(ProjectDirectory.MemberRemovalRequested event) {
        for(var a:applications.findAllByProjectIdOrderByCreatedAtDesc(event.projectId())) {
            if(!Set.of("CLOSED","REGULARIZED").contains(a.status)&&a.riskOwnerId.equals(event.accountId()))throw conflict("该成员仍承担提前开工风险责任，请先交接或关闭授权。");
            var all=ledger.findAllByApplicationIdOrderByCreatedAtDesc(a.id);
            for(var e:all)if("COMMITTED".equals(e.kind)&&!e.reversed&&e.ownerId.equals(event.accountId())) {
                var related=all.stream().filter(x->x.id.equals(e.id)||e.id.equals(x.commitmentId)).toList();var t=totals(related);
                if(t.outstandingHours().signum()>0||t.outstandingCost().signum()>0)throw conflict("该成员仍有未核销提前开工承诺，请先处理责任。");
            }
        }
    }
    private void editable(EarlyStartApplication a){if(!Set.of("DRAFT","RETURNED").contains(a.status))throw conflict("仅草稿或退回申请可更正。");}
    private void dates(LocalDate from,LocalDate to){if(from==null||to==null||to.isBefore(from))throw invalid("endsOn","请填写有效的开始和结束日期。");}
    private void nonzero(BigDecimal h,BigDecimal c){if(h.signum()==0&&c.signum()==0)throw invalid("hours","人时或费用至少一项大于零。");}
    private void scope(EarlyStartApplication a,String s){if(!List.of(a.scopeItems.split("\n")).contains(s))throw invalid("scopeItem","所选事项不在批准范围内。");}
    private void member(UUID p,UUID u){access.account(u);if(!projects.participant(p,u))throw invalid("ownerId","责任人须为当前项目启用成员。");}
    private void independent(SessionPrincipal actor,UUID p,UUID submitter){member(p,actor.accountId());if(actor.accountId().equals(submitter))throw conflict("提交人不能审批自己的申请，请独立授权成员复核。");}
    private EarlyStartApplication application(UUID p,UUID id){return applications.findById(id).filter(a->a.projectId.equals(p)).orElseThrow(BusinessRules::missing);}
    private EarlyClosureAllowance allowance(UUID a,UUID id){return allowances.findById(id).filter(x->x.applicationId.equals(a)).orElseThrow(()->invalid("allowanceId","请选择本申请的安全收尾授权。"));}
    private boolean over(LedgerPolicy.Totals t,BigDecimal h,BigDecimal c){return EarlyAuthorizationPolicy.over(t,h,c);}
    private String effective(EarlyStartApplication a,LedgerPolicy.Totals t){return EarlyAuthorizationPolicy.effective(a.status,a.startsOn,a.endsOn,t,a.approvedHours,a.approvedCost,LocalDate.now());}
    private LedgerPolicy.Totals totals(List<EarlyStartLedger> rows){return LedgerPolicy.totals(rows.stream().map(e->new LedgerPolicy.Entry(e.id,e.kind,e.hours,e.cost,e.commitmentId,e.reversed)).toList());}
    private RequestFacts facts(EarlyStartApplication a){return new RequestFacts(a.projectId,a.title,a.scope,List.of(a.scopeItems.split("\n")),a.requestedHours,a.requestedCost,a.startsOn,a.endsOn,a.riskOwnerId,a.stopConditions,a.missingItems,a.regularizationPlan);}
    private Application view(EarlyStartApplication a){var t=totals(ledger.findAllByApplicationIdOrderByCreatedAtDesc(a.id).stream().filter(x->x.allowanceId==null).toList());return new Application(a.id,a.version,facts(a),access.name(a.riskOwnerId),a.status,effective(a,t),a.approvedHours,a.approvedCost,a.submittedBy,access.name(a.submittedBy),access.name(a.approvedBy),a.approvedAt,a.regularizationPackageId,a.finishReason,t);}
    private ReviewRound view(EarlyStartReview r){return new ReviewRound(r.id,r.version,r.applicationId,r.status,snapshots.read(r.snapshot,RequestFacts.class),r.submittedBy,access.name(r.submittedBy),access.name(r.reviewedBy),r.createdAt,r.reviewedAt,r.reviewComment);}
    private Ledger view(EarlyStartLedger e){return new Ledger(e.id,e.applicationId,e.kind,e.commitmentType,e.scopeItem,e.ownerId,access.name(e.ownerId),e.occurredOn,e.hours,e.cost,e.evidence,e.commitmentId,e.reversesId,e.allowanceId,e.reversed,access.name(e.createdBy));}
    private Allowance view(EarlyClosureAllowance a){return new Allowance(a.id,a.applicationId,a.scopeItem,a.hours,a.cost,a.startsOn,a.endsOn,a.reason,access.name(a.approvedBy),totals(ledger.findAllByApplicationIdOrderByCreatedAtDesc(a.applicationId).stream().filter(x->a.id.equals(x.allowanceId)).toList()));}
}
