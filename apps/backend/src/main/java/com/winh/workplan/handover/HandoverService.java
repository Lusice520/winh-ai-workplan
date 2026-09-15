package com.winh.workplan.handover;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.handover.HandoverCommands.*;
import static com.winh.workplan.handover.HandoverViews.*;
import com.winh.workplan.business.*;
import com.winh.workplan.contracts.ContractDirectory;
import com.winh.workplan.files.FileDirectory;
import com.winh.workplan.presales.PresalesDirectory;
import com.winh.workplan.project.ProjectDirectory;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import java.time.*;
import java.util.*;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly=true)
public class HandoverService implements HandoverDirectory {
    private final HandoverCaseRepository cases;
    private final HandoverItemRepository items;
    private final HandoverReviewRepository reviews;
    private final HandoverPackageRepository packages;
    private final ProjectDirectory projects;
    private final FileDirectory files;
    private final ContractDirectory contracts;
    private final PresalesDirectory presales;
    private final EarlyStartDirectory early;
    private final BusinessAccess access;
    private final BusinessHistory history;
    private final ReviewSnapshot snapshots;
    HandoverService(HandoverCaseRepository cases,HandoverItemRepository items,HandoverReviewRepository reviews,
            HandoverPackageRepository packages,ProjectDirectory projects,FileDirectory files,ContractDirectory contracts,
            PresalesDirectory presales,EarlyStartDirectory early,BusinessAccess access,BusinessHistory history,ReviewSnapshot snapshots) {
        this.cases=cases;this.items=items;this.reviews=reviews;this.packages=packages;this.projects=projects;this.files=files;
        this.contracts=contracts;this.presales=presales;this.early=early;this.access=access;this.history=history;this.snapshots=snapshots;
    }
    public Workspace workspace(SessionPrincipal actor,UUID projectId) {
        var ctx=projects.requireReadable(actor,projectId,"HANDOVER_READ");var h=cases.findByProjectId(projectId).orElse(null);
        var allowed="CLOSED".equals(ctx.status())||!"PRESALES".equals(ctx.mainStage())?List.<String>of():access.actions(actor,ctx.authorization(),"HANDOVER_EDIT","HANDOVER_REVIEW","FILE_READ","PRESALES_READ","EARLY_START_READ");
        if(h==null)return new Workspace(null,List.of(),0,0,0,List.of(),List.of(),List.of(),allowed);
        var rows=items.findAllByCaseIdOrderBySortOrderAsc(h.id);var checks=rows.stream().map(i->check(actor,h,i)).toList();
        int required=(int)rows.stream().filter(this::requiredItem).count(),ready=0;
        for(int i=0;i<rows.size();i++)if(requiredItem(rows.get(i))&&"READY".equals(checks.get(i).status))ready++;
        var views=new ArrayList<Item>();for(int i=0;i<rows.size();i++)views.add(view(rows.get(i),checks.get(i)));
        return new Workspace(view(h,checks),views,required,ready,required-ready,
            reviews.findAllByCaseIdOrderByCreatedAtDesc(h.id).stream().map(this::view).toList(),
            packages.findAllByCaseIdOrderByCreatedAtDesc(h.id).stream().map(p->view(actor,h,p)).toList(),history.list(h.id),allowed);
    }
    @Transactional
    public Workspace initialize(SessionPrincipal actor,UUID projectId,Initialize input) {
        var ctx=writable(actor,projectId,"HANDOVER_EDIT");var res=access.reserve(actor,"hg.init:"+projectId,input.requestId(),input);
        if(res.replayed())return workspace(actor,projectId);
        if(cases.findByProjectId(projectId).isPresent())throw conflict("此项目已有移交清单，请在原清单维护。");
        var h=new HandoverCase();h.projectId=projectId;h.projectType=choice(input.projectType(),"projectType","SYSTEM_INTEGRATION","TECHNICAL_SERVICE","EQUIPMENT");
        member(projectId,input.receiverId());h.receiverId=input.receiverId();h.dueDate=date(input.dueDate());cases.saveAndFlush(h);
        String[][] template={{"BASE","项目基础资料","BASE","REQUIRED"},{"COMMERCIAL","商务依据","COMMERCIAL","REQUIRED"},
            {"SCOPE","范围边界确认","TECHNICAL","REQUIRED"},{"TECHNICAL","技术方案","TECHNICAL","REQUIRED"},
            {"ACCEPTANCE","验收目标","PLAN","REQUIRED"},{"SCHEDULE","关键实施计划","PLAN","REQUIRED"},
            {"INVESTMENT","投入估算与授权","RISK","REQUIRED"},{"RISKS","风险与未决事项","RISK","REQUIRED"},
            {"EQUIPMENT","设备与交付对象清单","TECHNICAL","CONDITIONAL"},{"COMMISSIONING","联调技术交底","TECHNICAL","CONDITIONAL"}};
        for(int n=0;n<template.length;n++) {
            var t=template[n];var i=new HandoverItem();i.caseId=h.id;i.itemKey=t[0];i.name=t[1];i.groupKey=t[2];i.applicability=t[3];i.sortOrder=n;
            i.ownerId=ctx.presalesOwnerId();i.dueDate=h.dueDate;
            if("EQUIPMENT".equals(i.itemKey))i.applicable=!"TECHNICAL_SERVICE".equals(h.projectType);
            if("COMMISSIONING".equals(i.itemKey))i.applicable="SYSTEM_INTEGRATION".equals(h.projectType);
            if(!i.applicable)i.note="当前项目类型的模板条件不适用，提交时由接收人核验。";
            if("BASE".equals(i.itemKey)){i.referenceKind="PROJECT";i.referenceId=projectId;}
            items.save(i);
        }
        items.flush();history.record(h.id,"HANDOVER","HANDOVER_INITIALIZED","快照 HG-2026-09-v1 适用性清单，主线沿用原项目。",actor.accountId());access.complete(res,h.id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace configure(SessionPrincipal actor,UUID projectId,Configure input) {
        writable(actor,projectId,"HANDOVER_EDIT");var h=handover(projectId);var res=access.reserve(actor,"hg.config:"+h.id,input.requestId(),input);
        if(res.replayed())return workspace(actor,projectId);version(h,input.version());editable(h);member(projectId,input.receiverId());
        h.receiverId=input.receiverId();h.dueDate=date(input.dueDate());String reason=required(input.reason(),"reason",2000);h.touch();cases.flush();
        history.record(h.id,"HANDOVER","HANDOVER_RESPONSIBILITY_CHANGED","更新接收责任与移交期限；"+reason,actor.accountId());access.complete(res,h.id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace editItem(SessionPrincipal actor,UUID projectId,UUID itemId,ItemInput input) {
        writable(actor,projectId,"HANDOVER_EDIT");var h=handover(projectId);var res=access.reserve(actor,"hg.item:"+itemId,input.requestId(),input);
        if(res.replayed())return workspace(actor,projectId);editable(h);
        var i=items.findById(itemId).filter(x->x.caseId.equals(h.id)).orElseThrow(BusinessRules::missing);version(i,input.version());member(projectId,input.ownerId());
        if(!input.applicable()&&("REQUIRED".equals(i.applicability)||conditionRequired(h,i)))throw invalid("applicable","当前类型要求此项，不能以不适用跳过。");
        i.ownerId=input.ownerId();i.dueDate=date(input.dueDate());i.applicable=input.applicable();i.note=optional(input.note(),"note",2000);
        if(!i.applicable)i.note=required(input.note(),"note",2000);
        if(!Set.of("BASE","COMMERCIAL").contains(i.itemKey)) {
            if(input.referenceId()==null){i.referenceId=null;i.referenceKind=null;}
            else {i.referenceKind=choice(input.referenceKind(),"referenceKind","FILE","DELIVERABLE");i.referenceId=input.referenceId();validateSource(actor,h,i);}
        }
        i.touch();h.touch();items.flush();cases.flush();history.record(h.id,"HANDOVER","HANDOVER_ITEM_UPDATED",i.name+"：维护责任、期限和成果引用。",actor.accountId());access.complete(res,itemId);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace setBasis(SessionPrincipal actor,UUID projectId,BasisInput input) {
        writable(actor,projectId,"HANDOVER_EDIT");var h=handover(projectId);var res=access.reserve(actor,"hg.basis:"+h.id,input.requestId(),input);
        if(res.replayed())return workspace(actor,projectId);version(h,input.version());editable(h);
        h.basisKind=choice(input.kind(),"kind","CONTRACT","AWARD","ENTRUSTMENT","EARLY_START");h.basisReferenceId=input.referenceId();h.basisNote=required(input.note(),"note",2000);
        var i=items.findAllByCaseIdOrderBySortOrderAsc(h.id).stream().filter(x->"COMMERCIAL".equals(x.itemKey)).findFirst().orElseThrow();
        if("CONTRACT".equals(h.basisKind)) {
            var c=contracts.requireArchivedPrimary(actor,projectId);if(input.referenceId()!=null&&!c.id().equals(input.referenceId()))throw invalid("referenceId","请选择项目当前主合同。");h.basisReferenceId=c.id();
        }
        i.referenceKind=h.basisKind;i.referenceId=h.basisReferenceId;validateSource(actor,h,i);i.touch();h.touch();items.flush();cases.flush();
        history.record(h.id,"HANDOVER","HANDOVER_BASIS_LINKED","关联独立商务依据，不更改合同或商机事实。",actor.accountId());access.complete(res,h.id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace submit(SessionPrincipal actor,UUID projectId,Submit input) {
        writable(actor,projectId,"HANDOVER_EDIT");var h=handover(projectId);var res=access.reserve(actor,"hg.submit:"+h.id,input.requestId(),input);
        if(res.replayed())return workspace(actor,projectId);version(h,input.version());editable(h);member(projectId,h.receiverId);
        if(actor.accountId().equals(h.receiverId))throw conflict("提交人与接收人须不同，请指定独立接收人。");
        var snap=validatedSnapshot(actor,h);var r=new HandoverReview();r.caseId=h.id;r.submittedBy=actor.accountId();r.submissionNote=required(input.note(),"note",2000);
        r.snapshot=snapshots.json(snap);r.snapshotHash=snapshots.hash(snap);reviews.saveAndFlush(r);h.status="SUBMITTED";h.touch();cases.flush();
        history.record(h.id,"HANDOVER","DG01_SUBMITTED","提交 DG-01，锁定适用性、责任和当前成果版本。",actor.accountId());access.complete(res,r.id);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace review(SessionPrincipal actor,UUID projectId,UUID reviewId,Review input) {
        writable(actor,projectId,"HANDOVER_REVIEW");var h=handover(projectId);var res=access.reserve(actor,"hg.review:"+reviewId,input.requestId(),input);
        if(res.replayed())return workspace(actor,projectId);
        var r=reviews.findById(reviewId).filter(x->x.caseId.equals(h.id)).orElseThrow(BusinessRules::missing);version(r,input.version());
        if(!"SUBMITTED".equals(r.status)||!"SUBMITTED".equals(h.status))throw conflict("此轮 DG-01 不在待评审状态。");
        member(projectId,actor.accountId());if(r.submittedBy.equals(actor.accountId()))throw conflict("提交人不能评审自己的 DG-01。");
        String decision=choice(input.decision(),"decision","APPROVED","RETURNED"),comment=required(input.comment(),"comment",2000);
        if("APPROVED".equals(decision)) {
            if(!h.receiverId.equals(actor.accountId()))throw conflict("请由指定接收人确认交付可接收性。");
            if(!r.snapshotHash.equals(snapshots.hash(validatedSnapshot(actor,h))))throw conflict("提交后责任或资料已变化，请退回后重新提交最新清单。");
            var p=new HandoverPackage();p.caseId=h.id;p.reviewId=r.id;p.number="HG-"+p.id.toString().substring(0,8).toUpperCase(Locale.ROOT);
            p.snapshot=r.snapshot;p.snapshotHash=r.snapshotHash;p.approvedBy=actor.accountId();p.reviewComment=comment;packages.saveAndFlush(p);h.currentPackageId=p.id;
            projects.activate(projectId);history.record(projectId,"PROJECT","DG01_PASSED","DG-01 通过，生成移交包 "+p.number+"；可接续 DG-02 准备，主阶段仍为售前。",actor.accountId());
        }
        r.status=decision;r.reviewedBy=actor.accountId();r.reviewedAt=Instant.now();r.reviewComment=comment;r.touch();h.status=decision;h.touch();reviews.flush();cases.flush();
        history.record(h.id,"HANDOVER","DG01_"+decision,"DG-01 独立评审："+comment,actor.accountId());access.complete(res,reviewId);return workspace(actor,projectId);
    }
    @Transactional
    public Workspace reopen(SessionPrincipal actor,UUID projectId,Reopen input) {
        writable(actor,projectId,"HANDOVER_EDIT");var h=handover(projectId);var res=access.reserve(actor,"hg.reopen:"+h.id,input.requestId(),input);
        if(res.replayed())return workspace(actor,projectId);version(h,input.version());if(!"APPROVED".equals(h.status))throw conflict("仅已通过的移交可重开新轮次。");
        String reason=required(input.reason(),"reason",2000);h.status="DRAFT";h.touch();cases.flush();history.record(h.id,"HANDOVER","DG01_REOPENED","重开移交，旧包保留并停止作为当前准入依据；"+reason,actor.accountId());access.complete(res,h.id);return workspace(actor,projectId);
    }
    public PackageDetail packageDetail(SessionPrincipal actor,UUID projectId,UUID id) {
        projects.requireReadable(actor,projectId,"HANDOVER_READ");var h=handover(projectId);
        var p=packages.findById(id).filter(x->x.caseId.equals(h.id)).orElseThrow(BusinessRules::missing);var snap=snapshots.read(p.snapshot,Snapshot.class);
        var atApproval=new HandoverCase();atApproval.projectId=projectId;atApproval.projectType=snap.projectType();atApproval.basisKind=snap.basisKind();atApproval.basisReferenceId=snap.basisReferenceId();
        return new PackageDetail(view(actor,h,p),snap.projectCode(),snap.projectName(),snap.projectType(),snap.templateVersion(),access.name(snap.receiverId()),snap.dueDate(),snap.basisKind(),snap.basisNote(),
            snap.items().stream().map(f->{var i=restore(f);return view(i,check(actor,atApproval,i));}).toList());
    }
    @Override @Transactional(readOnly=true,noRollbackFor=DomainException.class)
    public Optional<PackageReference> approvedPackageSummary(SessionPrincipal actor,UUID projectId) {
        projects.requireReadable(actor,projectId,"HANDOVER_READ");
        var existing=cases.findByProjectId(projectId);
        if(existing.isEmpty()||!"APPROVED".equals(existing.get().status)||existing.get().currentPackageId==null)return Optional.empty();
        var h=existing.get();return packages.findById(h.currentPackageId).map(p->new PackageReference(p.id,projectId,h.receiverId,p.number,p.snapshotHash,h.basisKind,h.projectType));
    }
    @Override @Transactional(readOnly=true,noRollbackFor=DomainException.class)
    public PackageReference requireCurrentPackage(SessionPrincipal actor,UUID projectId) {
        projects.requireReadable(actor,projectId,"HANDOVER_READ");var h=handover(projectId);
        if(!"APPROVED".equals(h.status)||h.currentPackageId==null)throw conflict("项目尚无当前已通过的 DG-01 移交包。");
        var p=packages.findById(h.currentPackageId).orElseThrow(BusinessRules::missing);
        if(items.findAllByCaseIdOrderBySortOrderAsc(h.id).stream().anyMatch(i->i.applicable&&!check(actor,h,i).readable))
            throw new DomainException(org.springframework.http.HttpStatus.FORBIDDEN,"SOURCE_RESTRICTED","当前账号无法完整核验移交来源。");
        if(!current(actor,h,p))throw conflict("移交依据已变化或当前账号不能完整核验，请完成新一轮 DG-01。");
        return new PackageReference(p.id,projectId,h.receiverId,p.number,p.snapshotHash,h.basisKind,h.projectType);
    }
    @Transactional public void regularize(SessionPrincipal actor,UUID projectId,UUID applicationId,EarlyStartCommands.Finish input) {
        projects.requireWritable(actor,projectId,"EARLY_START_EDIT");var p=requireCurrentPackage(actor,projectId);
        if("EARLY_START".equals(p.basisKind()))throw conflict("请先补齐合同、中标通知或委托函正常商务依据，提前开工不能自证转正。");
        early.regularize(actor,projectId,applicationId,p.id(),input);
    }
    @EventListener public void preventRemoval(ProjectDirectory.MemberRemovalRequested event) {
        cases.findByProjectId(event.projectId()).ifPresent(h->{
            if(h.receiverId.equals(event.accountId()))throw conflict("该成员仍为移交接收人，请先交接接收责任。");
            if(!"APPROVED".equals(h.status)&&items.findAllByCaseIdOrderBySortOrderAsc(h.id).stream().anyMatch(i->i.applicable&&i.ownerId.equals(event.accountId())))throw conflict("该成员仍有移交清单责任，请先交接。");
        });
    }
    private Snapshot validatedSnapshot(SessionPrincipal actor,HandoverCase h) {
        var ctx=projects.requireReadable(actor,h.projectId,"HANDOVER_READ");member(h.projectId,h.receiverId);
        var facts=new ArrayList<ItemFact>();var problems=new ArrayList<String>();
        for(var i:items.findAllByCaseIdOrderBySortOrderAsc(h.id)) {
            var c=check(actor,h,i);if((requiredItem(i)&&!"READY".equals(c.status))||"INVALID".equals(c.status))problems.add(i.name+"："+c.problem);
            facts.add(new ItemFact(i.id,i.itemKey,i.name,i.groupKey,i.applicability,i.applicable,i.ownerId,i.dueDate,i.referenceKind,i.referenceId,i.note,c.stamp));
        }
        if(!problems.isEmpty())throw conflict("移交缺项："+String.join("；",problems));
        return new Snapshot(h.projectId,ctx.code(),ctx.name(),h.projectType,h.templateVersion,h.receiverId,h.dueDate,h.basisKind,h.basisReferenceId,h.basisNote,facts);
    }
    private Checked check(SessionPrincipal actor,HandoverCase h,HandoverItem i) {
        if(!i.applicable)return new Checked("NOT_APPLICABLE",null,"不适用",true,"NA:"+i.note);
        try {
            member(h.projectId,i.ownerId);
            if("BASE".equals(i.itemKey)) {var p=projects.requireReadable(actor,h.projectId,"HANDOVER_READ");return ready("原项目基础资料",p.id()+":"+p.code()+":"+p.name()+":"+p.salesOwnerId()+":"+p.presalesOwnerId());}
            if(i.referenceId==null)return new Checked(requiredItem(i)?"MISSING":"OPTIONAL","尚未关联有效依据",null,true,"MISSING");
            return validateSource(actor,h,i);
        } catch(DomainException e) {boolean readable=e.status().value()!=403&&e.status().value()!=404;return new Checked("INVALID",readable?e.getMessage():"依据不存在或无查看权限",null,readable,"INVALID");}
    }
    private Checked validateSource(SessionPrincipal actor,HandoverCase h,HandoverItem i) {
        if("CONTRACT".equals(i.referenceKind)) {var c=contracts.requireArchivedPrimary(actor,h.projectId);if(!c.id().equals(i.referenceId))throw conflict("当前主合同已变化。");return ready("已归档主合同 · "+c.number(),"CONTRACT:"+snapshots.hash(c));}
        if("EARLY_START".equals(i.referenceKind)){var e=early.requireEffective(actor,h.projectId,i.referenceId);return ready(e.title(),"EARLY:"+snapshots.hash(e));}
        if(Set.of("FILE","AWARD","ENTRUSTMENT").contains(i.referenceKind==null?"":i.referenceKind)) {
            var f=files.requirePublished(actor,h.projectId,i.referenceId,Set.of("AWARD","ENTRUSTMENT").contains(i.referenceKind)?"CONTRACT":"INVESTMENT".equals(i.itemKey)?"COST":null);
            return ready(f.title()+" · v"+f.versionNumber(),"FILE:"+f.versionId()+":"+f.stateVersion()+":"+f.sha256());
        }
        if("DELIVERABLE".equals(i.referenceKind)) {
            var d=presales.reference(actor,h.projectId,i.referenceId);if(!d.current()||!"APPROVED".equals(d.status()))throw conflict("售前成果须为当前已批准版本。");
            if("INVESTMENT".equals(i.itemKey)&&!"ESTIMATE".equals(d.kind()))throw invalid("referenceId","投入依据须使用已批准的估算成果或成本资料。");
            return ready(d.title()+" · v"+d.versionNumber(),"DELIVERABLE:"+d.id()+":"+d.version());
        }
        throw invalid("referenceKind","请选择与清单对应的资料或售前成果依据。");
    }
    private boolean current(SessionPrincipal actor,HandoverCase h,HandoverPackage p){if(!"APPROVED".equals(h.status)||!p.id.equals(h.currentPackageId))return false;try{return p.snapshotHash.equals(snapshots.hash(validatedSnapshot(actor,h)));}catch(DomainException e){return false;}}
    private boolean conditionRequired(HandoverCase h,HandoverItem i){return "EQUIPMENT".equals(i.itemKey)&&!"TECHNICAL_SERVICE".equals(h.projectType)||"COMMISSIONING".equals(i.itemKey)&&"SYSTEM_INTEGRATION".equals(h.projectType);}
    private boolean requiredItem(HandoverItem i){return i.applicable&&!"OPTIONAL".equals(i.applicability);}
    private ProjectDirectory.ProjectContext writable(SessionPrincipal a,UUID p,String permission){var ctx=projects.requireWritable(a,p,permission);if(!"PRESALES".equals(ctx.mainStage()))throw conflict("交付阶段请通过正式变更维护批准依据。");return ctx;}
    private HandoverCase handover(UUID p){return cases.findByProjectId(p).orElseThrow(()->conflict("请先初始化本项目移交清单。"));}
    private void editable(HandoverCase h){if(!Set.of("DRAFT","RETURNED").contains(h.status))throw conflict("仅草稿或退回清单可修改，已通过需显式重开。");}
    private void member(UUID p,UUID u){access.account(u);if(!projects.participant(p,u))throw invalid("ownerId","责任人和接收人须为当前项目启用成员。");}
    private LocalDate date(LocalDate d){if(d==null)throw invalid("dueDate","请填写明确期限。");return d;}
    private Checked ready(String title,String stamp){return new Checked("READY",null,title,true,stamp);}
    private record Checked(String status,String problem,String title,boolean readable,String stamp) {}
    private Case view(HandoverCase h,List<Checked> checks){boolean visible=checks.size()>1&&checks.get(1).readable;return new Case(h.id,h.version,h.projectId,h.projectType,h.templateVersion,h.status,h.receiverId,access.name(h.receiverId),h.dueDate,h.basisKind,visible?h.basisReferenceId:null,h.basisNote);}
    private Item view(HandoverItem i,Checked c){return new Item(i.id,i.version,i.itemKey,i.name,i.groupKey,i.applicability,i.applicable,i.ownerId,access.name(i.ownerId),i.dueDate,i.referenceKind,c.readable?i.referenceId:null,c.title,i.note,c.status,c.problem,requiredItem(i)&&!"READY".equals(c.status)&&i.dueDate.isBefore(LocalDate.now()));}
    private ReviewRound view(HandoverReview r){return new ReviewRound(r.id,r.version,r.status,r.submittedBy,access.name(r.submittedBy),r.submissionNote,access.name(r.reviewedBy),r.createdAt,r.reviewedAt,r.reviewComment,r.snapshotHash);}
    private HandoverViews.Package view(SessionPrincipal a,HandoverCase h,HandoverPackage p){return new HandoverViews.Package(p.id,p.number,p.snapshotHash,access.name(p.approvedBy),p.createdAt,current(a,h,p),p.reviewComment);}
    private HandoverItem restore(ItemFact f){var i=new HandoverItem();i.id=f.id();i.itemKey=f.key();i.name=f.name();i.groupKey=f.groupKey();i.applicability=f.applicability();i.applicable=f.applicable();i.ownerId=f.ownerId();i.dueDate=f.dueDate();i.referenceKind=f.referenceKind();i.referenceId=f.referenceId();i.note=f.note();return i;}
}
