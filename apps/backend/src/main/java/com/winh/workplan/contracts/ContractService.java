package com.winh.workplan.contracts;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.contracts.ContractCommands.*;
import static com.winh.workplan.contracts.ContractViews.*;
import com.winh.workplan.business.*;
import com.winh.workplan.files.FileDirectory;
import com.winh.workplan.crm.CrmDirectory;
import com.winh.workplan.iam.audit.*;
import com.winh.workplan.iam.shared.CorrelationIdHolder;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.PageResponse;
import com.winh.workplan.project.ProjectDirectory;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly = true)
public class ContractService implements ContractDirectory {
    private final ContractMasterRepository contracts;
    private final ContractNodeRepository nodes;
    private final ContractNodeRevisionRepository nodeRevisions;
    private final ContractNodeSnapshots nodeSnapshots;
    private final ContractRecordRepository records;
    private final ContractFileLinkRepository links;
    private final ContractArchiveReviewRepository reviews;
    private final ProjectDirectory projects;
    private final FileDirectory files;
    private final BusinessAccess access;
    private final BusinessHistory history;
    private final CrmDirectory crm;
    private final AuditRecorder audit;
    ContractService(ContractMasterRepository contracts, ContractNodeRepository nodes, ContractRecordRepository records,
            ContractFileLinkRepository links, ContractArchiveReviewRepository reviews, ProjectDirectory projects,
            FileDirectory files, BusinessAccess access, BusinessHistory history, CrmDirectory crm, AuditRecorder audit,
            ContractNodeRevisionRepository nodeRevisions, ContractNodeSnapshots nodeSnapshots) {
        this.contracts=contracts; this.nodes=nodes; this.records=records; this.links=links; this.reviews=reviews;
        this.projects=projects; this.files=files; this.access=access; this.history=history;
        this.crm=crm; this.audit=audit;
        this.nodeRevisions=nodeRevisions; this.nodeSnapshots=nodeSnapshots;
    }
    public PageResponse<Master> list(SessionPrincipal actor, String q, UUID projectId, String status, String archiveStatus, int page, int size) {
        Map<UUID,ProjectDirectory.ProjectContext> visible = new HashMap<>();
        projects.visible(actor,"CONTRACT_READ").forEach(p -> visible.put(p.id(),p));
        var rows=contracts.findAll(Sort.by(Sort.Direction.DESC,"updatedAt")).stream().filter(c -> visible.containsKey(c.projectId))
            .filter(c -> projectId==null || projectId.equals(c.projectId)).filter(c -> blank(status)||status.equals(status(c)))
            .filter(c -> blank(archiveStatus)||archiveStatus.equals(c.archiveStatus))
            .filter(c -> matches(q,c.number,c.title,visible.get(c.projectId).customerName(),visible.get(c.projectId).name()))
            .map(c -> view(actor,c,visible.get(c.projectId))).toList();
        return page(rows,page,size);
    }
    @Override public List<Master> forProject(SessionPrincipal actor, UUID projectId) {
        var ctx=projects.requireReadable(actor,projectId,"CONTRACT_READ");
        return contracts.findAllByProjectIdOrderByCreatedAtDesc(projectId).stream().map(c->view(actor,c,ctx)).toList();
    }
    @Transactional
    public Detail detail(SessionPrincipal actor, UUID id) {
        var c=contract(id); var ctx=projects.requireReadable(actor,c.projectId,"CONTRACT_READ");
        boolean sensitive=access.allows(actor,"CONTRACT_SENSITIVE_READ",ctx.authorization());
        boolean fileVisible=sensitive&&access.allows(actor,"FILE_READ",ctx.authorization())&&access.allows(actor,"FILE_CONTRACT_READ",ctx.authorization());
        var allowed=access.actions(actor,ctx.authorization(),"CONTRACT_EDIT","CONTRACT_ARCHIVE","FILE_READ","FILE_UPLOAD","FILE_DOWNLOAD","FILE_PUBLISH","FILE_CONTRACT_READ");
        if(!sensitive)allowed=allowed.stream().filter(p->!Set.of("CONTRACT_EDIT","CONTRACT_ARCHIVE").contains(p)).toList();
        if("CLOSED".equals(ctx.status()))allowed=allowed.stream().filter(p->p.endsWith("_READ")||"FILE_DOWNLOAD".equals(p)).toList();
        var scopedActions=new ArrayList<>(allowed);
        if(crm.canReadCustomer(actor,ctx.customerId()))scopedActions.add("CRM_CUSTOMER_READ");
        if(crm.canReadOpportunity(actor,ctx.opportunityId()))scopedActions.add("CRM_OPPORTUNITY_READ");
        audit.record(new AuditEventCommand("CONTRACT_VIEWED",actor.accountId(),"CONTRACT",id,AuditOutcome.SUCCEEDED,
            CorrelationIdHolder.currentOrCreate(),sensitive?"查看合同敏感内容。":"查看合同摘要。",null,null));
        var nodeViews=sensitive?nodes.findAllByContractIdOrderByDueDateAscCreatedAtAsc(id).stream().map(this::view).toList():List.<Node>of();
        var recordViews=sensitive?records.findAllByContractIdOrderByCreatedAtDesc(id).stream().map(this::view).toList():List.<Amendment>of();
        var fileViews=fileVisible?links.findAllByContractIdOrderByCreatedAtDesc(id).stream()
            .map(l->new LinkedFile(l.id,l.kind,l.active,files.reference(actor,c.projectId,l.fileVersionId))).toList():List.<LinkedFile>of();
        var revisionViews=sensitive?nodeRevisions.findAllByContractIdOrderByCreatedAtDesc(id).stream().map(this::view).toList():List.<NodeRevision>of();
        return new Detail(view(actor,c,ctx),nodeViews,revisionViews,recordViews,fileViews,
            sensitive?reviews.findAllByContractIdOrderByCreatedAtDesc(id).stream().map(this::view).toList():List.of(),
            sensitive?history.list(id):List.of(),scopedActions,sensitive,fileVisible,fileVisible?missingItems(actor,c):List.of());
    }
    @Transactional
    public Detail create(SessionPrincipal actor, MasterInput input) {
        var ctx=projects.requireWritable(actor,input.projectId(),"CONTRACT_EDIT"); sensitive(actor,ctx);
        var reservation=access.reserve(actor,"contract.create",input.requestId(),input);
        if(reservation.replayed())return detail(actor,reservation.targetId());
        var c=new ContractMaster(); c.projectId=ctx.id(); c.createdBy=actor.accountId();
        assign(c,input);
        if(contracts.existsByNumberKey(c.numberKey))throw invalid("number","合同编号已存在，请核查原合同。");
        c.primaryContract=!contracts.existsByProjectIdAndPrimaryContractTrue(c.projectId);
        contracts.saveAndFlush(c);history.record(c.id,"CONTRACT","CONTRACT_REGISTERED","登记已签署合同事实，待归档。",actor.accountId());
        history.record(c.projectId,"PROJECT","CONTRACT_LINKED","关联签署后合同主档。",actor.accountId());
        access.complete(reservation,c.id);return detail(actor,c.id);
    }
    @Transactional
    public Detail edit(SessionPrincipal actor, UUID id, MasterInput input) {
        var c=writable(actor,id,"CONTRACT_EDIT");
        var reservation=access.reserve(actor,"contract.edit:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);
        version(c,input.version());if(c.everArchived)throw conflict("已归档合同请登记补充或变更，原主档不可覆盖。");
        notSubmitted(c);String previous=c.numberKey;assign(c,input);
        if(!previous.equals(c.numberKey)&&contracts.existsByNumberKey(c.numberKey))throw invalid("number","合同编号已存在。");
        validatePaymentTotal(c,c.amount);c.touch();contracts.flush();
        history.record(id,"CONTRACT","CONTRACT_CORRECTED","更正归档前合同主档。",actor.accountId());access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional
    public Detail addNode(SessionPrincipal actor, UUID id, NodeInput input) {
        var c=writable(actor,id,"CONTRACT_EDIT");
        var reservation=access.reserve(actor,"contract.node:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);
        version(c,input.version());notSubmitted(c);notTerminated(c);
        if(c.everArchived&&input.recordId()==null)throw invalid("recordId","已归档合同新增约定节点须关联补充或变更记录。");
        if(input.recordId()!=null)records.findById(input.recordId()).filter(r->r.contractId.equals(id)&&!"TERMINATION".equals(r.kind))
            .orElseThrow(()->invalid("recordId","请选择本合同的补充或变更记录。"));
        var n=new ContractNode();n.contractId=id;n.recordId=input.recordId();n.title=required(input.title(),"title",160);
        n.kind=choice(input.kind(),"kind","PAYMENT","ACCEPTANCE");n.dueDate=input.dueDate();
        if(n.dueDate==null)throw invalid("dueDate","请填写约定日期。");
        n.conditions=required(input.conditions(),"conditions",2000);
        if("PAYMENT".equals(n.kind)){n.amount=amount(input.amount(),"amount");if(n.amount.signum()==0)throw invalid("amount","付款节点金额须大于零。");}
        nodes.saveAndFlush(n);validatePaymentTotal(c,c.amount);c.archiveStatus="DRAFT";c.touch();contracts.flush();
        recordNodeHistory(n,"CREATED",null,"登记合同约定节点。",actor);
        history.record(id,"CONTRACT","CONTRACT_NODE_CREATED","新增约定节点。",actor.accountId());access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional
    public Detail completeNode(SessionPrincipal actor, UUID id, UUID nodeId, CompleteNode input) {
        var c=writable(actor,id,"CONTRACT_EDIT");
        var reservation=access.reserve(actor,"contract.node.complete:"+nodeId,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);
        var n=nodes.findById(nodeId).filter(x->x.contractId.equals(id)).orElseThrow(BusinessRules::missing);version(n,input.version());
        notSubmitted(c);
        if(!"PLANNED".equals(n.status))throw conflict("此节点已登记完成事实。");
        completedDate(c,input.completedOn());
        var before=nodeSnapshots.fact(n);
        n.status="COMPLETED";n.completedOn=input.completedOn();n.evidence=required(input.evidence(),"evidence",4000);n.completedBy=actor.accountId();n.touch();nodes.flush();
        recordNodeHistory(n,"COMPLETED",before,"登记节点完成证据。",actor);
        history.record(id,"CONTRACT","CONTRACT_NODE_COMPLETED","登记节点完成证据；资金实际记录独立维护。",actor.accountId());
        access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional
    public Detail correctNode(SessionPrincipal actor, UUID id, UUID nodeId, CorrectNode input) {
        var c=writable(actor,id,"CONTRACT_EDIT");
        var reservation=access.reserve(actor,"contract.node.correct:"+nodeId,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);
        var n=nodes.findById(nodeId).filter(x->x.contractId.equals(id)).orElseThrow(BusinessRules::missing);
        version(n,input.version());version(c,input.contractVersion());notSubmitted(c);
        String kind=choice(input.kind(),"kind","TERMS","COMPLETION","REOPEN");
        String reason=required(input.reason(),"reason",2000);
        var before=nodeSnapshots.fact(n);
        if("TERMS".equals(kind)) {
            notTerminated(c);
            if(c.everArchived&&input.recordId()==null)throw invalid("recordId","已归档节点调整须关联本合同的签署补充或变更依据。");
            if(input.recordId()!=null) {
                var r=records.findById(input.recordId()).filter(x->x.contractId.equals(id)&&!"TERMINATION".equals(x.kind))
                    .orElseThrow(()->invalid("recordId","请选择本合同的补充或变更记录。"));
                files.requirePublished(actor,c.projectId,r.fileVersionId,"CONTRACT");
            }
            n.title=required(input.title(),"title",160);n.conditions=required(input.conditions(),"conditions",2000);
            if(input.dueDate()==null)throw invalid("dueDate","请填写约定日期。");
            n.dueDate=input.dueDate();n.recordId=input.recordId();
            if("PAYMENT".equals(n.kind)) {
                n.amount=amount(input.amount(),"amount");
                if(n.amount.signum()==0)throw invalid("amount","付款节点金额须大于零。");
            }
            if(before.equals(nodeSnapshots.fact(n)))throw conflict("约定内容未变化，无需登记更正。");
            validatePaymentTotal(c,c.amount);c.archiveStatus="DRAFT";c.touch();contracts.flush();
        } else {
            if(!"COMPLETED".equals(n.status))throw conflict("只可更正已经登记的完成事实。");
            if("COMPLETION".equals(kind)) {
                completedDate(c,input.completedOn());
                String evidence=required(input.evidence(),"evidence",4000);
                if(n.completedOn.equals(input.completedOn())&&n.evidence.equals(evidence))throw conflict("完成日期和证据未变化，无需登记更正。");
                n.completedOn=input.completedOn();n.evidence=evidence;n.completedBy=actor.accountId();
            } else {
                n.status="PLANNED";n.completedOn=null;n.evidence=null;n.completedBy=null;
            }
        }
        n.touch();nodes.flush();
        String event="REOPEN".equals(kind)?"COMPLETION_REOPENED":kind+"_CORRECTED";
        recordNodeHistory(n,event,before,reason,actor);
        history.record(id,"CONTRACT","CONTRACT_NODE_"+event,
            ("TERMS".equals(kind)?"更正约定，待重新归档；":"更正节点完成事实，保留原记录；")+reason,actor.accountId());
        access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional
    public Detail addRecord(SessionPrincipal actor, UUID id, RecordInput input) {
        var c=writable(actor,id,"CONTRACT_EDIT");
        var reservation=access.reserve(actor,"contract.record:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);
        version(c,input.version());notSubmitted(c);notTerminated(c);
        var r=new ContractRecord();r.contractId=id;r.kind=choice(input.kind(),"kind","SUPPLEMENT","AMENDMENT","TERMINATION");
        r.title=required(input.title(),"title",160);r.description=required(input.description(),"description",4000);
        r.signedOn=input.signedOn();signedDate(r.signedOn);
        if(r.signedOn.isBefore(c.signedOn))throw invalid("signedOn","补充或变更签署日期不能早于主合同。");
        files.requirePublished(actor,c.projectId,input.fileVersionId(),"CONTRACT");r.fileVersionId=input.fileVersionId();
        if(input.amountAfter()!=null){
            if("TERMINATION".equals(r.kind))throw invalid("amountAfter","终止不直接改写签约金额，请在终止说明记录结算依据。");
            r.amountAfter=positive(input.amountAfter());r.amountBefore=c.amount;validatePaymentTotal(c,r.amountAfter);c.amount=r.amountAfter;
        }
        if("TERMINATION".equals(r.kind))c.terminated=true;
        r.createdBy=actor.accountId();records.saveAndFlush(r);link(c,input.fileVersionId(),r.kind,actor);
        c.archiveStatus="DRAFT";c.touch();contracts.flush();
        history.record(id,"CONTRACT","CONTRACT_RECORD_ADDED","登记签署后的补充、变更或终止依据，待重新归档。",actor.accountId());
        access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional
    public Detail linkFile(SessionPrincipal actor, UUID id, LinkFile input) {
        var c=writable(actor,id,"CONTRACT_EDIT");
        var reservation=access.reserve(actor,"contract.file:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);
        version(c,input.version());notSubmitted(c);
        String kind=choice(input.kind(),"kind","SIGNED","TECHNICAL","OTHER");
        files.requirePublished(actor,c.projectId,input.fileVersionId(),"CONTRACT");
        link(c,input.fileVersionId(),kind,actor);c.archiveStatus="DRAFT";c.touch();contracts.flush();
        history.record(id,"CONTRACT","CONTRACT_FILE_LINKED","关联当前有效签署资料版本，保留旧引用。",actor.accountId());
        access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional
    public Detail submit(SessionPrincipal actor, UUID id, SubmitArchive input) {
        var c=writable(actor,id,"CONTRACT_EDIT");
        var reservation=access.reserve(actor,"contract.submit:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);
        version(c,input.version());notSubmitted(c);
        if("ARCHIVED".equals(c.archiveStatus))throw conflict("当前合同资料已归档，无需重复提交。");
        var missing=missingItems(actor,c);if(!missing.isEmpty())throw conflict("归档资料尚未齐备："+String.join("；",missing));
        var review=new ContractArchiveReview();review.contractId=id;review.submittedBy=actor.accountId();review.submissionNote=required(input.note(),"note",2000);
        c.archiveStatus="SUBMITTED";c.touch();contracts.flush();review.snapshot=snapshot(actor,c);reviews.saveAndFlush(review);
        history.record(id,"CONTRACT","CONTRACT_ARCHIVE_SUBMITTED","营销提交签署资料归档，等待独立接收。",actor.accountId());
        access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional
    public Detail review(SessionPrincipal actor, UUID id, UUID reviewId, ReviewArchive input) {
        var c=writable(actor,id,"CONTRACT_ARCHIVE");
        var reservation=access.reserve(actor,"contract.review:"+reviewId,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);
        var r=reviews.findById(reviewId).filter(x->x.contractId.equals(id)).orElseThrow(BusinessRules::missing);version(r,input.version());
        if(!"SUBMITTED".equals(r.status)||!"SUBMITTED".equals(c.archiveStatus))throw conflict("此归档申请不在待接收状态。");
        if(r.submittedBy.equals(actor.accountId()))throw conflict("提交人不能接收自己的归档，请另一名授权管理人员复核。");
        String decision=choice(input.decision(),"decision","ARCHIVED","RETURNED");
        if("ARCHIVED".equals(decision)){
            if(!missingItems(actor,c).isEmpty()||!r.snapshot.equals(snapshot(actor,c)))throw conflict("合同或文件在提交后发生变化，请退回后重新提交最新资料。");
            c.everArchived=true;c.archivedBy=actor.accountId();c.archivedAt=Instant.now();
        }
        r.status=decision;r.reviewComment=required(input.comment(),"comment",2000);r.reviewedBy=actor.accountId();r.reviewedAt=Instant.now();r.touch();
        c.archiveStatus=decision;c.touch();reviews.flush();contracts.flush();
        history.record(id,"CONTRACT","CONTRACT_"+decision,"合同归档"+("ARCHIVED".equals(decision)?"接收完成。":"退回补齐。"),actor.accountId());
        access.complete(reservation,id);return detail(actor,id);
    }
    @Transactional
    public Detail makePrimary(SessionPrincipal actor, UUID id, MakePrimary input) {
        var c=writable(actor,id,"CONTRACT_EDIT");
        var reservation=access.reserve(actor,"contract.primary:"+id,input.requestId(),input);
        if(reservation.replayed())return detail(actor,id);
        version(c,input.version());String reason=required(input.reason(),"reason",2000);notTerminated(c);
        if(!"ARCHIVED".equals(c.archiveStatus)||!missingItems(actor,c).isEmpty())throw conflict("当前主合同须已归档且签署资料有效。");
        var all=contracts.findAllByProjectIdOrderByCreatedAtDesc(c.projectId);
        all.stream().filter(x->x.primaryContract&&!x.id.equals(id)).forEach(x->{x.primaryContract=false;x.touch();});contracts.flush();
        c.primaryContract=true;c.touch();contracts.flush();history.record(id,"CONTRACT","CONTRACT_PRIMARY_CHANGED","调整为项目当前主合同；"+reason,actor.accountId());
        access.complete(reservation,id);return detail(actor,id);
    }
    @Override @Transactional(readOnly=true,noRollbackFor=com.winh.workplan.iam.shared.DomainException.class)
    public ContractReference requireArchivedPrimary(SessionPrincipal actor, UUID projectId) {
        projects.requireReadable(actor,projectId,"CONTRACT_READ");
        var c=contracts.findAllByProjectIdOrderByCreatedAtDesc(projectId).stream().filter(x->x.primaryContract&&!x.terminated).findFirst()
            .orElseThrow(()->conflict("项目尚无有效主合同。"));
        if(!"ARCHIVED".equals(c.archiveStatus)||!missingItems(actor,c).isEmpty())throw conflict("主合同尚未完成有效签署资料归档。");
        return new ContractReference(c.id,c.version,projectId,c.number,links.findAllByContractIdOrderByCreatedAtDesc(c.id).stream()
            .filter(l->l.active&&"SIGNED".equals(l.kind)).map(l->l.fileVersionId).toList());
    }
    @Override @Transactional(readOnly=true,noRollbackFor=com.winh.workplan.iam.shared.DomainException.class)
    public ContractNodeReference requireNode(SessionPrincipal actor,UUID projectId,UUID nodeId) {
        projects.requireReadable(actor,projectId,"CONTRACT_READ");projects.requireReadable(actor,projectId,"CONTRACT_SENSITIVE_READ");
        var n=nodes.findById(nodeId).orElseThrow(BusinessRules::missing);
        var c=contracts.findById(n.contractId).filter(x->x.projectId.equals(projectId)&&!x.terminated).orElseThrow(BusinessRules::missing);
        if(!"ARCHIVED".equals(c.archiveStatus))throw conflict("里程碑引用的合同节点尚未完成归档。");
        return new ContractNodeReference(n.id,c.id,n.version,n.title,n.dueDate);
    }
    @Override @Transactional(readOnly=true,noRollbackFor=com.winh.workplan.iam.shared.DomainException.class)
    public List<ContractNodeReference> nodeOptions(SessionPrincipal actor,UUID projectId) {
        projects.requireReadable(actor,projectId,"CONTRACT_READ");projects.requireReadable(actor,projectId,"CONTRACT_SENSITIVE_READ");
        return contracts.findAllByProjectIdOrderByCreatedAtDesc(projectId).stream().filter(c->!c.terminated&&"ARCHIVED".equals(c.archiveStatus))
            .flatMap(c->nodes.findAllByContractIdOrderByDueDateAscCreatedAtAsc(c.id).stream()
                .map(n->new ContractNodeReference(n.id,c.id,n.version,n.title,n.dueDate))).toList();
    }
    @Override @Transactional(readOnly=true,noRollbackFor=com.winh.workplan.iam.shared.DomainException.class)
    public ContractFinancialReference financialReference(SessionPrincipal actor,UUID projectId,UUID contractId,boolean requireArchived) {
        projects.requireReadable(actor,projectId,"CONTRACT_READ");projects.requireReadable(actor,projectId,"CONTRACT_SENSITIVE_READ");
        var c=contracts.findById(contractId).filter(x->x.projectId.equals(projectId)).orElseThrow(BusinessRules::missing);
        if(requireArchived&&(c.terminated||!"ARCHIVED".equals(c.archiveStatus)||!missingItems(actor,c).isEmpty()))throw conflict("收入来源合同须为同项目已归档且未终止的合同。");
        return new ContractFinancialReference(c.id,c.version,c.number,c.title,status(c),c.archiveStatus);
    }
    private void assign(ContractMaster c,MasterInput input) {
        c.number=required(input.number(),"number",80);c.numberKey=normalized(c.number);c.title=required(input.title(),"title",160);
        c.partyA=required(input.partyA(),"partyA",240);c.partyB=required(input.partyB(),"partyB",240);c.amount=positive(input.amount());
        c.signedOn=input.signedOn();signedDate(c.signedOn);c.effectiveOn=input.effectiveOn();
        if(c.effectiveOn==null)throw invalid("effectiveOn","请填写合同生效日期。");c.scope=required(input.scope(),"scope",4000);
    }
    private void link(ContractMaster c,UUID versionId,String kind,SessionPrincipal actor) {
        var existing=links.findAllByContractIdOrderByCreatedAtDesc(c.id);
        if(existing.stream().anyMatch(l->l.fileVersionId.equals(versionId)&&l.kind.equals(kind)&&l.active))return;
        var nextFile=files.reference(actor,c.projectId,versionId);
        existing.stream().filter(l->l.active&&l.kind.equals(kind)).filter(l->"SIGNED".equals(kind)||files.reference(actor,c.projectId,l.fileVersionId).documentId().equals(nextFile.documentId())).forEach(l->{l.active=false;l.touch();});
        var l=new ContractFileLink();l.contractId=c.id;l.fileVersionId=versionId;l.kind=kind;l.linkedBy=actor.accountId();links.saveAndFlush(l);
    }
    private List<String> missingItems(SessionPrincipal actor,ContractMaster c) {
        var active=links.findAllByContractIdOrderByCreatedAtDesc(c.id).stream().filter(l->l.active).toList();var missing=new ArrayList<String>();
        if(active.stream().noneMatch(l->"SIGNED".equals(l.kind)))missing.add("缺少主合同签署件");
        for(var l:active){var ref=files.reference(actor,c.projectId,l.fileVersionId);if(!ref.current()||!"PUBLISHED".equals(ref.status()))missing.add("资料“"+ref.title()+"”已失效或待发布");}
        return missing;
    }
    private String snapshot(SessionPrincipal actor,ContractMaster c) {
        var out=new ArrayList<String>();out.add("contract:"+c.id+":"+c.version);
        nodes.findAllByContractIdOrderByDueDateAscCreatedAtAsc(c.id).forEach(n->out.add("node:"+n.id+":"+n.version));
        records.findAllByContractIdOrderByCreatedAtDesc(c.id).forEach(r->out.add("record:"+r.id+":"+r.version));
        links.findAllByContractIdOrderByCreatedAtDesc(c.id).stream().filter(l->l.active).forEach(l->{var f=files.requirePublished(actor,c.projectId,l.fileVersionId,"CONTRACT");out.add("file:"+l.id+":"+f.versionId()+":"+f.stateVersion()+":"+f.sha256());});
        return String.join("|",out);
    }
    private ContractMaster contract(UUID id) { return contracts.findById(id).orElseThrow(BusinessRules::missing); }
    private ContractMaster writable(SessionPrincipal actor,UUID id,String permission) {
        var c=contract(id);var ctx=projects.requireWritable(actor,c.projectId,permission);sensitive(actor,ctx);return c;
    }
    private void sensitive(SessionPrincipal actor,ProjectDirectory.ProjectContext ctx) { access.require(actor,"CONTRACT_READ",ctx.authorization());access.require(actor,"CONTRACT_SENSITIVE_READ",ctx.authorization()); }
    private void notSubmitted(ContractMaster c){if("SUBMITTED".equals(c.archiveStatus))throw conflict("归档接收中，请先完成接收或退回。");}
    private void notTerminated(ContractMaster c){if(c.terminated)throw conflict("合同已终止，不能新增履约约定。");}
    private void signedDate(LocalDate date){if(date==null||date.isAfter(LocalDate.now()))throw invalid("signedOn","请填写不晚于今天的实际签署日期。");}
    private void completedDate(ContractMaster c,LocalDate date){if(date==null||date.isAfter(LocalDate.now())||date.isBefore(c.signedOn))throw invalid("completedOn","完成日期应在签署日当天或之后且不晚于今天。");}
    private void recordNodeHistory(ContractNode n,String kind,NodeFact before,String reason,SessionPrincipal actor){
        var r=new ContractNodeRevision();r.contractId=n.contractId;r.nodeId=n.id;r.kind=kind;
        r.beforeSnapshot=nodeSnapshots.json(before);r.afterSnapshot=nodeSnapshots.json(nodeSnapshots.fact(n));
        r.reason=reason;r.recordedBy=actor.accountId();nodeRevisions.saveAndFlush(r);
    }
    private BigDecimal positive(BigDecimal value){var v=amount(value,"amount");if(v.signum()==0)throw invalid("amount","签约金额须大于零。");return v;}
    private void validatePaymentTotal(ContractMaster c,BigDecimal limit){var total=nodes.findAllByContractIdOrderByDueDateAscCreatedAtAsc(c.id).stream().filter(n->"PAYMENT".equals(n.kind)).map(n->n.amount).reduce(BigDecimal.ZERO,BigDecimal::add);if(total.compareTo(limit)>0)throw invalid("amount","付款节点金额合计不能超过合同总额。");}
    private boolean blank(String value){return value==null||value.isBlank();}
    private String status(ContractMaster c){return c.terminated?"TERMINATED":c.effectiveOn.isAfter(LocalDate.now())?"SIGNED":"EFFECTIVE";}
    private Master view(SessionPrincipal actor,ContractMaster c,ProjectDirectory.ProjectContext p){boolean sensitive=access.allows(actor,"CONTRACT_SENSITIVE_READ",p.authorization());return new Master(c.id,c.version,c.projectId,p.code(),p.name(),p.opportunityId(),p.customerId(),p.customerName(),c.number,c.title,sensitive?c.partyA:null,sensitive?c.partyB:null,sensitive?c.amount:null,c.signedOn,c.effectiveOn,sensitive?c.scope:null,status(c),c.archiveStatus,c.primaryContract,c.everArchived,access.name(p.salesOwnerId()),access.name(c.archivedBy),c.archivedAt,c.updatedAt);}
    private Node view(ContractNode n){return new Node(n.id,n.version,n.recordId,n.title,n.kind,n.dueDate,n.amount,n.conditions,n.status,n.completedOn,n.evidence,access.name(n.completedBy));}
    private NodeRevision view(ContractNodeRevision r){return new NodeRevision(r.id,r.nodeId,r.kind,nodeSnapshots.read(r.beforeSnapshot),nodeSnapshots.read(r.afterSnapshot),r.reason,access.name(r.recordedBy),r.createdAt);}
    private Amendment view(ContractRecord r){return new Amendment(r.id,r.kind,r.title,r.description,r.signedOn,r.fileVersionId,r.amountBefore,r.amountAfter,access.name(r.createdBy),r.createdAt);}
    private ArchiveReview view(ContractArchiveReview r){return new ArchiveReview(r.id,r.version,r.status,r.submissionNote,r.submittedBy,access.name(r.submittedBy),access.name(r.reviewedBy),r.createdAt,r.reviewedAt,r.reviewComment);}
}
