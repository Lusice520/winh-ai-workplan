package com.winh.workplan.presales;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.presales.PresalesCommands.*;
import static com.winh.workplan.presales.PresalesViews.*;
import com.winh.workplan.business.*;
import com.winh.workplan.project.ProjectDirectory;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly = true)
public class PresalesService implements PresalesDirectory {
    private final ProjectDirectory projects;
    private final PresalesActionRepository actions;
    private final PresalesDeliverableRepository deliverables;
    private final PresalesInitiationRepository initiations;
    private final PresalesInvestmentRepository investments;
    private final PresalesQuoteReviewRepository quotes;
    private final BusinessAccess access;
    private final BusinessHistory history;
    public PresalesService(ProjectDirectory projects, PresalesActionRepository actions,
            PresalesDeliverableRepository deliverables, PresalesInitiationRepository initiations,
            PresalesInvestmentRepository investments, PresalesQuoteReviewRepository quotes,
            BusinessAccess access, BusinessHistory history) {
        this.projects = projects; this.actions = actions; this.deliverables = deliverables;
        this.initiations = initiations; this.investments = investments; this.quotes = quotes;
        this.access = access; this.history = history;
    }
    @EventListener @Transactional
    public void initialize(ProjectDirectory.ProjectCreated event) {
        String[][] template = {{"SURVEY","现场调研"},{"REQUIREMENTS","需求梳理"},{"SOLUTION","方案设计"},
            {"ESTIMATE","工程量与采购估算"},{"QUOTATION","报价准备"},{"BIDDING","招投标"},{"HANDOVER","技术交底准备"}};
        for (int n = 0; n < template.length; n++) {
            var a = new PresalesAction(); a.projectId = event.id(); a.actionKey = template[n][0]; a.name = template[n][1];
            a.sortOrder = n; a.status = "NOT_STARTED"; a.ownerAccountId = event.presalesOwnerId(); actions.save(a);
        }
        history.record(event.id(), "PROJECT", "PRESALES_TEMPLATE_SNAPSHOTTED", "初始化 7 项售前规定动作（2026-09-12 模板）。", event.actorId());
    }
    @EventListener
    public void preventUnassignedResponsibilities(ProjectDirectory.MemberRemovalRequested event) {
        if (actions.findAllByProjectIdOrderBySortOrderAsc(event.projectId()).stream()
                .anyMatch(a -> a.ownerAccountId.equals(event.accountId()) && !Set.of("COMPLETED","SKIPPED").contains(a.status)))
            throw conflict("该成员仍有未完成售前动作，请先交接责任。");
    }
    public Workspace workspace(SessionPrincipal actor, UUID projectId) {
        var project = projects.requireReadable(actor, projectId, "PRESALES_READ");
        var rows = investments.findAllByProjectIdOrderByCreatedAtDesc(projectId);
        var totals = totals(rows);
        boolean investmentDetailsVisible = access.allows(actor, "PRESALES_INVESTMENT_READ", project.authorization());
        String snapshot = snapshot(projectId);
        return new Workspace(actions.findAllByProjectIdOrderBySortOrderAsc(projectId).stream().map(this::view).toList(),
            initiations.findAllByProjectIdOrderByCreatedAtDesc(projectId).stream().map(this::view).toList(),
            investmentDetailsVisible ? rows.stream().map(this::view).toList() : List.of(), quotes.findAllByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .map(q -> view(q, snapshot)).toList(), totals.committedHours, totals.committedCost, totals.actualHours, totals.actualCost,
            investmentDetailsVisible,
            "CLOSED".equals(project.status()) ? List.of() : access.actions(actor, project.authorization(), "PRESALES_EDIT", "PRESALES_REVIEW", "PRESALES_INVESTMENT_EDIT"));
    }
    @Override @Transactional(readOnly=true,noRollbackFor=com.winh.workplan.iam.shared.DomainException.class)
    public DeliverableReference reference(SessionPrincipal actor, UUID projectId, UUID id) {
        var ctx = projects.requireReadable(actor, projectId, "PRESALES_READ");
        if (id == null) throw invalid("referenceId", "请选择售前成果版本。");
        var d = deliverable(projectId, id);
        if ("ESTIMATE".equals(d.kind)) access.readable(actor, "PRESALES_INVESTMENT_READ", ctx.authorization());
        boolean current = deliverables.findAllByActionIdOrderByVersionNumberDesc(d.actionId).getFirst().id.equals(id);
        return new DeliverableReference(d.id, d.actionId, d.projectId, d.version, d.versionNumber, d.title, d.kind, d.status, current);
    }
    @Transactional
    public Workspace saveInitiation(SessionPrincipal actor, UUID projectId, UUID id, InitiationInput input) {
        projects.requireWritable(actor, projectId, "PRESALES_EDIT");
        var reservation = access.reserve(actor, "ps.initiation:" + projectId, input.requestId(), List.of(String.valueOf(id), input));
        if (reservation.replayed()) return workspace(actor, projectId);
        var all = initiations.findAllByProjectIdOrderByCreatedAtDesc(projectId);
        var i = id == null ? new PresalesInitiation() : initiation(projectId, id);
        if (id == null && all.stream().anyMatch(x -> Set.of("DRAFT","SUBMITTED").contains(x.status)))
            throw conflict("已有未完成的投入申请，请继续该申请。");
        if (id != null) { version(i, input.version()); if (!Set.of("DRAFT","RETURNED").contains(i.status)) throw conflict("仅草稿或退回的申请可编辑。"); }
        i.projectId = projectId; i.purpose = required(input.purpose(),"purpose",2000); i.scope = required(input.scope(),"scope",2000);
        i.expectedOutputs = required(input.expectedOutputs(),"expectedOutputs",2000); i.exitConditions = required(input.exitConditions(),"exitConditions",2000);
        i.requestedHours = amount(input.requestedHours(),"requestedHours"); i.requestedCost = amount(input.requestedCost(),"requestedCost");
        if (input.endsOn() == null || input.startsOn() == null || input.endsOn().isBefore(input.startsOn())) throw invalid("endsOn","截止日期不能早于开始日期。");
        i.startsOn = input.startsOn(); i.endsOn = input.endsOn(); i.status = "DRAFT"; i.touch(); initiations.saveAndFlush(i);
        history.record(projectId,"PROJECT","PRESALES_INITIATION_SAVED","保存 SG-01 申请草稿；累计申请 " + i.requestedHours + " 人时。",actor.accountId());
        access.complete(reservation,i.id); return workspace(actor,projectId);
    }
    @Transactional
    public Workspace submitInitiation(SessionPrincipal actor, UUID projectId, UUID id, SubmitInput input) {
        projects.requireWritable(actor, projectId,"PRESALES_EDIT");
        var reservation = access.reserve(actor,"ps.submit:" + id,input.requestId(),input);
        if (reservation.replayed()) return workspace(actor,projectId);
        var i = initiation(projectId,id); version(i,input.version());
        if (!Set.of("DRAFT","RETURNED").contains(i.status)) throw conflict("申请当前不能重复提交。");
        if (i.endsOn.isBefore(LocalDate.now())) throw invalid("endsOn","申请已过期，请先更新有效期。");
        i.status="SUBMITTED"; i.submittedBy=actor.accountId(); i.submittedAt=Instant.now(); i.touch(); initiations.flush();
        history.record(projectId,"PROJECT","SG01_SUBMITTED","提交 SG-01，等待独立复核。",actor.accountId());
        access.complete(reservation,id); return workspace(actor,projectId);
    }
    @Transactional
    public Workspace reviewInitiation(SessionPrincipal actor, UUID projectId, UUID id, ReviewInput input) {
        projects.requireWritable(actor,projectId,"PRESALES_REVIEW");
        var reservation=access.reserve(actor,"ps.review:"+id,input.requestId(),input);
        if(reservation.replayed())return workspace(actor,projectId);
        var i=initiation(projectId,id); version(i,input.version());
        if(!"SUBMITTED".equals(i.status))throw conflict("仅待评审申请可复核。");
        independentReviewer(actor,projectId,i.submittedBy);
        String decision=choice(input.decision(),"decision","APPROVED","RETURNED");
        String comment=required(input.comment(),"comment",2000);
        if("APPROVED".equals(decision)) {
            i.approvedHours=amount(input.approvedHours(),"approvedHours"); i.approvedCost=amount(input.approvedCost(),"approvedCost");
            if(i.approvedHours.compareTo(i.requestedHours)>0 || i.approvedCost.compareTo(i.requestedCost)>0)throw invalid("approvedHours","批准额度不能超过本次累计申请。");
            if(i.endsOn.isBefore(LocalDate.now()))throw conflict("申请已过期，请退回更新期限。");
            var t=totals(investments.findAllByProjectIdOrderByCreatedAtDesc(projectId));
            if(t.usedHours().compareTo(i.approvedHours)>0 || t.usedCost().compareTo(i.approvedCost)>0)throw conflict("累计批准额度不能低于已承诺及实际占用。");
            projects.activate(projectId);
        }
        i.status=decision; i.reviewComment=comment; i.reviewedBy=actor.accountId(); i.reviewedAt=Instant.now(); i.touch(); initiations.flush();
        history.record(projectId,"PROJECT","SG01_"+decision,"SG-01 复核："+comment,actor.accountId());
        access.complete(reservation,id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace updateAction(SessionPrincipal actor,UUID projectId,UUID id,ActionInput input) {
        projects.requireWritable(actor,projectId,"PRESALES_EDIT");
        var reservation=access.reserve(actor,"ps.action:"+id,input.requestId(),input);
        if(reservation.replayed())return workspace(actor,projectId);
        var a=action(projectId,id);version(a,input.version()); member(projectId,input.ownerAccountId());
        String next=choice(input.status(),"status","NOT_STARTED","IN_PROGRESS","BLOCKED","COMPLETED","SKIPPED");
        String note=optional(input.note(),"note",2000);
        if(Set.of("COMPLETED","SKIPPED","BLOCKED").contains(next)||Set.of("COMPLETED","SKIPPED").contains(a.status))
            note=required(note,"note",2000);
        if("COMPLETED".equals(next)&&deliverables.findAllByActionIdOrderByVersionNumberDesc(id).isEmpty()
                && (note==null || !note.contains("无需成果"))) throw invalid("note","完成前请登记成果；确实无需成果时，注明“无需成果”及理由。");
        String previous=a.status; a.status=next; a.ownerAccountId=input.ownerAccountId();a.dueDate=input.dueDate();a.note=note;a.touch();actions.flush();
        history.record(projectId,"PROJECT","PRESALES_ACTION_UPDATED",a.name+"："+previous+" → "+next+(note==null?"":"；"+note),actor.accountId());
        access.complete(reservation,id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace deliver(SessionPrincipal actor,UUID projectId,UUID actionId,DeliverableInput input) {
        projects.requireWritable(actor,projectId,"PRESALES_EDIT");
        var reservation=access.reserve(actor,"ps.deliver:"+actionId,input.requestId(),input);
        if(reservation.replayed())return workspace(actor,projectId);
        var a=action(projectId,actionId);version(a,input.version());
        var previous=deliverables.findAllByActionIdOrderByVersionNumberDesc(actionId);
        var d=new PresalesDeliverable();d.projectId=projectId;d.actionId=actionId;
        d.versionNumber=previous.stream().mapToInt(x->x.versionNumber).max().orElse(0)+1;
        d.title=required(input.title(),"title",160);d.kind=choice(input.kind(),"kind","SURVEY","REQUIREMENTS","SOLUTION","ESTIMATE","QUOTATION","BIDDING","HANDOVER","OTHER");
        d.scope=required(input.scope(),"scope",2000);d.content=required(input.content(),"content",12000);d.changeNote=required(input.changeNote(),"changeNote",2000);
        d.status=choice(input.status(),"status","DRAFT","IN_REVIEW");d.createdBy=actor.accountId();
        previous.forEach(x->{if(!"SUPERSEDED".equals(x.status)){x.status="SUPERSEDED";x.touch();}});
        deliverables.saveAndFlush(d);a.touch();actions.flush();
        history.record(projectId,"PROJECT","PRESALES_DELIVERABLE_CREATED",a.name+"登记成果 v"+d.versionNumber+"；"+d.changeNote,actor.accountId());
        access.complete(reservation,d.id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace invest(SessionPrincipal actor,UUID projectId,InvestmentInput input) {
        var context = projects.requireWritable(actor,projectId,"PRESALES_INVESTMENT_EDIT");
        access.require(actor, "PRESALES_INVESTMENT_READ", context.authorization());
        var reservation=access.reserve(actor,"ps.invest:"+projectId,input.requestId(),input);
        if(reservation.replayed())return workspace(actor,projectId);
        String kind=choice(input.kind(),"kind","COMMITTED","ACTUAL","REVERSAL");
        String description=required(input.description(),"description",2000);
        var rows=investments.findAllByProjectIdOrderByCreatedAtDesc(projectId);
        var entry=new PresalesInvestment();entry.projectId=projectId;entry.kind=kind;entry.occurredOn=input.occurredOn();entry.description=description;entry.createdBy=actor.accountId();
        if("REVERSAL".equals(kind)) {
            var original=rows.stream().filter(x->x.id.equals(input.reversesId())).findFirst().orElseThrow(()->invalid("reversesId","请选择原投入记录。"));
            if(original.reversed || "REVERSAL".equals(original.kind))throw conflict("此记录已冲正或不支持冲正。");
            if(rows.stream().anyMatch(x->original.id.equals(x.commitmentId)&&!x.reversed))throw conflict("此承诺已有实际投入，请先处理实际投入的冲正。");
            original.reversed=true;original.touch();entry.reversesId=original.id;entry.initiationId=original.initiationId;
            entry.hours=original.hours.negate();entry.cost=original.cost.negate();
        } else {
            var approved=effectiveApproval(projectId);entry.initiationId=approved.id;
            if(input.occurredOn()==null || input.occurredOn().isBefore(approved.startsOn)||input.occurredOn().isAfter(approved.endsOn)
                    || input.occurredOn().isAfter(LocalDate.now()))throw invalid("occurredOn","投入日期须在批准期限内且不能晚于今天。");
            entry.hours=amount(input.hours(),"hours");entry.cost=amount(input.cost(),"cost");
            if(entry.hours.signum()==0 && entry.cost.signum()==0)throw invalid("hours","人时或费用至少一项大于零。");
            if(input.commitmentId()!=null) {
                if(!"ACTUAL".equals(kind))throw invalid("commitmentId","只有实际投入可以核销承诺。");
                var commitment=rows.stream().filter(x->x.id.equals(input.commitmentId())&&"COMMITTED".equals(x.kind)&&!x.reversed).findFirst()
                    .orElseThrow(()->invalid("commitmentId","所选承诺已失效或不属于当前项目。"));
                BigDecimal paidH=BigDecimal.ZERO,paidC=BigDecimal.ZERO;
                for(var x:rows)if(commitment.id.equals(x.commitmentId)&&!x.reversed){paidH=paidH.add(x.hours);paidC=paidC.add(x.cost);}
                if(paidH.add(entry.hours).compareTo(commitment.hours)>0||paidC.add(entry.cost).compareTo(commitment.cost)>0)
                    throw invalid("commitmentId","实际投入超过该承诺剩余额度。");
                entry.commitmentId=commitment.id;
            }
            var combined=new ArrayList<>(rows);combined.add(entry);var total=totals(combined);
            if(total.usedHours().compareTo(approved.approvedHours)>0||total.usedCost().compareTo(approved.approvedCost)>0)
                throw conflict("投入将超过当前批准额度，请先申请追加投入。");
        }
        investments.saveAndFlush(entry);
        history.record(projectId,"PROJECT","PRESALES_INVESTMENT_RECORDED","登记"+kind+"投入；用途与依据见授权投入明细。",actor.accountId());
        access.complete(reservation,entry.id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace submitQuote(SessionPrincipal actor,UUID projectId,QuoteInput input) {
        projects.requireWritable(actor,projectId,"PRESALES_EDIT");
        var reservation=access.reserve(actor,"ps.quote:"+projectId,input.requestId(),input);
        if(reservation.replayed())return workspace(actor,projectId);
        effectiveApproval(projectId);
        if(quotes.findAllByProjectIdOrderByCreatedAtDesc(projectId).stream().anyMatch(q->"SUBMITTED".equals(q.status)))throw conflict("已有待审核报价/投标申请。");
        if(input.deliverableIds()==null||input.deliverableIds().isEmpty()||input.deliverableIds().size()>50)throw invalid("deliverableIds","请选择明确的最终成果版本。");
        var selected=input.deliverableIds().stream().distinct().map(id->deliverable(projectId,id)).toList();
        if(selected.stream().anyMatch(d->"SUPERSEDED".equals(d.status)))throw invalid("deliverableIds","已替代的成果不能作为最终版本。");
        var q=new PresalesQuoteReview();q.projectId=projectId;
        q.feasibility=required(input.feasibility(),"feasibility",2000);q.scope=required(input.scope(),"scope",2000);
        q.estimate=required(input.estimate(),"estimate",2000);q.priceAuthorization=required(input.priceAuthorization(),"priceAuthorization",2000);
        q.constraints=required(input.constraints(),"constraints",2000);q.assumptionsRisks=required(input.assumptionsRisks(),"assumptionsRisks",2000);
        q.finalVersion=required(input.finalVersion(),"finalVersion",2000);q.deliverableIds=String.join(",",selected.stream().map(d->d.id.toString()).toList());
        q.actionSnapshot=snapshot(projectId);q.status="SUBMITTED";q.submittedBy=actor.accountId();quotes.saveAndFlush(q);
        history.record(projectId,"PROJECT","SG02_SUBMITTED","提交 SG-02；锁定 "+selected.size()+" 个成果版本及动作快照。",actor.accountId());
        access.complete(reservation,q.id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace reviewQuote(SessionPrincipal actor,UUID projectId,UUID id,ReviewInput input) {
        projects.requireWritable(actor,projectId,"PRESALES_REVIEW");
        var reservation=access.reserve(actor,"ps.quote.review:"+id,input.requestId(),input);
        if(reservation.replayed())return workspace(actor,projectId);
        var q=quotes.findById(id).filter(x->x.projectId.equals(projectId)).orElseThrow(BusinessRules::missing);version(q,input.version());
        if(!"SUBMITTED".equals(q.status))throw conflict("仅待审核的 SG-02 可复核。");independentReviewer(actor,projectId,q.submittedBy);
        String decision=choice(input.decision(),"decision","APPROVED","RETURNED");String comment=required(input.comment(),"comment",2000);
        if("APPROVED".equals(decision)) {
            effectiveApproval(projectId);
            if(!q.actionSnapshot.equals(snapshot(projectId)))throw conflict("提交后动作或成果已变化，请退回后重新提交最新快照。");
            for(UUID documentId:ids(q.deliverableIds)) {var d=deliverable(projectId,documentId);if("SUPERSEDED".equals(d.status))throw conflict("成果已被替代。");d.status="APPROVED";d.touch();}
        }
        q.status=decision;q.reviewedBy=actor.accountId();q.reviewedAt=Instant.now();q.reviewComment=comment;q.touch();quotes.flush();deliverables.flush();
        history.record(projectId,"PROJECT","SG02_"+decision,"报价/投标评审："+comment,actor.accountId());
        access.complete(reservation,id);return workspace(actor,projectId);
    }
    private PresalesInitiation initiation(UUID project,UUID id) {return initiations.findById(id).filter(i->i.projectId.equals(project)).orElseThrow(BusinessRules::missing);}
    private PresalesAction action(UUID project,UUID id) {return actions.findById(id).filter(a->a.projectId.equals(project)).orElseThrow(BusinessRules::missing);}
    private PresalesDeliverable deliverable(UUID project,UUID id) {return deliverables.findById(id).filter(a->a.projectId.equals(project)).orElseThrow(BusinessRules::missing);}
    private void member(UUID project,UUID id) {access.account(id);if(!projects.participant(project,id))throw invalid("ownerAccountId","请选择当前项目的有效成员。");}
    private void independentReviewer(SessionPrincipal actor,UUID project,UUID submittedBy) {
        member(project,actor.accountId());if(actor.accountId().equals(submittedBy))throw conflict("提交人不能审核自己的申请，请由另一名授权成员复核。");
    }
    private PresalesInitiation effectiveApproval(UUID project) {
        var latest=initiations.findAllByProjectIdOrderByCreatedAtDesc(project).stream().filter(i->"APPROVED".equals(i.status)).findFirst()
            .orElseThrow(()->conflict("SG-01 尚未通过，不能登记实质投入或提交报价评审。"));
        if(LocalDate.now().isBefore(latest.startsOn)||LocalDate.now().isAfter(latest.endsOn))throw conflict("投入批准不在有效期内，请申请有效投入期限。");
        return latest;
    }
    private String snapshot(UUID project) {
        return String.join(",",actions.findAllByProjectIdOrderBySortOrderAsc(project).stream().map(a->a.id+":"+a.version).toList());
    }
    private static List<UUID> ids(String value) {return Arrays.stream(value.split(",")).map(UUID::fromString).toList();}
    private Totals totals(List<PresalesInvestment> rows) {
        BigDecimal ch=BigDecimal.ZERO,cc=BigDecimal.ZERO,ah=BigDecimal.ZERO,ac=BigDecimal.ZERO,linkedH=BigDecimal.ZERO,linkedC=BigDecimal.ZERO;
        for(var r:rows) {if(r.reversed||"REVERSAL".equals(r.kind))continue;
            if("COMMITTED".equals(r.kind)){ch=ch.add(r.hours);cc=cc.add(r.cost);}
            if("ACTUAL".equals(r.kind)){ah=ah.add(r.hours);ac=ac.add(r.cost);if(r.commitmentId!=null){linkedH=linkedH.add(r.hours);linkedC=linkedC.add(r.cost);}}
        }
        return new Totals(ch.subtract(linkedH),cc.subtract(linkedC),ah,ac);
    }
    private record Totals(BigDecimal committedHours,BigDecimal committedCost,BigDecimal actualHours,BigDecimal actualCost) {
        BigDecimal usedHours(){return committedHours.add(actualHours);} BigDecimal usedCost(){return committedCost.add(actualCost);}
    }
    private InitiationView view(PresalesInitiation i) {return new InitiationView(i.id,i.version,i.purpose,i.scope,i.expectedOutputs,i.exitConditions,
        i.requestedHours,i.requestedCost,i.approvedHours,i.approvedCost,i.startsOn,i.endsOn,i.status,i.submittedBy,access.name(i.submittedBy),i.submittedAt,
        access.name(i.reviewedBy),i.reviewedAt,i.reviewComment);}
    private ActionView view(PresalesAction a) {return new ActionView(a.id,a.version,a.actionKey,a.name,a.status,a.ownerAccountId,access.name(a.ownerAccountId),a.dueDate,a.note,
        deliverables.findAllByActionIdOrderByVersionNumberDesc(a.id).stream().map(this::view).toList());}
    private DeliverableView view(PresalesDeliverable d) {return new DeliverableView(d.id,d.title,d.kind,d.scope,d.content,d.versionNumber,d.changeNote,d.status,access.name(d.createdBy),d.createdAt);}
    private InvestmentView view(PresalesInvestment i) {return new InvestmentView(i.id,i.kind,i.hours,i.cost,i.occurredOn,i.description,i.commitmentId,i.reversesId,i.reversed,access.name(i.createdBy));}
    private QuoteView view(PresalesQuoteReview q,String snapshot) {return new QuoteView(q.id,q.version,q.feasibility,q.scope,q.estimate,q.priceAuthorization,q.constraints,
        q.assumptionsRisks,q.finalVersion,ids(q.deliverableIds),q.status,q.actionSnapshot.equals(snapshot),q.submittedBy,access.name(q.submittedBy),access.name(q.reviewedBy),q.reviewComment,q.createdAt,q.reviewedAt);}
}
