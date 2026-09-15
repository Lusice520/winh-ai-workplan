package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.delivery.baseline.DeliveryContent.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import com.winh.workplan.business.*;
import com.winh.workplan.contracts.ContractDirectory;
import com.winh.workplan.delivery.DeliveryConfigurationDirectory;
import com.winh.workplan.delivery.DeliveryConfigurationDirectory.PublishedConfiguration;
import com.winh.workplan.handover.HandoverDirectory;
import com.winh.workplan.handover.HandoverDirectory.PackageReference;
import com.winh.workplan.iam.account.AccountDirectory;
import com.winh.workplan.iam.authorization.ResourceContext;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.iam.shared.PageResponse;
import com.winh.workplan.project.ProjectDirectory;
import com.winh.workplan.work.WorkDirectory;
import java.time.*;
import java.util.*;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/** Shared domain collaborators. Commands and read controllers own transactions; this holder is deliberately not proxied. */
@Service
class DeliveryStore {
    final DeliveryCaseRepository cases; final DeliveryObjectRepository objects;
    final DeliveryResourceRepository resources; final DeliveryFindingRepository findings;
    final DeliveryRoundRepository rounds; final DeliveryReviewRepository reviews;
    final DeliveryBaselineRepository baselines; final DeliveryRevisionRepository revisions; final DeliveryChangeRepository changes;
    final ProjectDirectory projects; final BusinessAccess access; final BusinessHistory history; final DeliveryCodec codec;
    final HandoverDirectory handover; final DeliveryConfigurationDirectory configurations;
    final WorkDirectory work; final ContractDirectory contracts; final AccountDirectory accounts;
    DeliveryStore(DeliveryCaseRepository cases,DeliveryObjectRepository objects,DeliveryResourceRepository resources,
            DeliveryFindingRepository findings,DeliveryRoundRepository rounds,DeliveryReviewRepository reviews,
            DeliveryBaselineRepository baselines,DeliveryRevisionRepository revisions,DeliveryChangeRepository changes,
            ProjectDirectory projects,BusinessAccess access,BusinessHistory history,DeliveryCodec codec,
            HandoverDirectory handover,DeliveryConfigurationDirectory configurations,WorkDirectory work,
            ContractDirectory contracts,AccountDirectory accounts){
        this.cases=cases;this.objects=objects;this.resources=resources;this.findings=findings;this.rounds=rounds;this.reviews=reviews;
        this.baselines=baselines;this.revisions=revisions;this.changes=changes;this.projects=projects;this.access=access;this.history=history;
        this.codec=codec;this.handover=handover;this.configurations=configurations;this.work=work;this.contracts=contracts;this.accounts=accounts;
    }
    PageResponse<Row> list(SessionPrincipal actor,String q,String status,int page,int size){
        var visible=projects.visible(actor,"DG2_READ").stream().filter(p->matches(q,p.name(),p.code(),p.customerName()))
            .filter(p->cases.findByProjectId(p.id()).isPresent()||eligibleForQueue(actor,p.id()))
            .map(p->row(p,cases.findByProjectId(p.id()).orElse(null)))
            .filter(r->status==null||status.isBlank()||status.equals(r.status())).toList();
        return page(visible,page,size);
    }
    Workspace workspace(SessionPrincipal actor,UUID projectId){
        var p=projects.requireReadable(actor,projectId,"DG2_READ");var c=cases.findByProjectId(projectId).orElse(null);
        var allowed=new ArrayList<String>();boolean writable=!"CLOSED".equals(p.status());
        if(c==null){
            if(writable&&"PRESALES".equals(p.mainStage())&&allows(actor,p,"DG2_EDIT")&&projects.participant(projectId,actor.accountId()))allowed.add("INITIALIZE");
            return new Workspace(row(p,null),null,List.of(),List.of(),List.of(),List.of(sourceCheck(actor,projectId,null)),
                List.of(),List.of(),List.of(),List.of(),List.of(),allowed);
        }
        var snap=snapshot(c);boolean money=allows(actor,p,"DELIVERY_BUDGET_READ");boolean manager=c.managerId.equals(actor.accountId());
        var people=people(snap);var objectFacts=projectObjects(snap.objects(),money);
        if("APPROVED".equals(c.status)&&allows(actor,p,"DELIVERY_EXECUTION_READ"))allowed.add("VIEW_EXECUTION");
        if(writable){
            if(!frozen(c)&&allows(actor,p,"DG2_EDIT"))allowed.add("EDIT_RESPONSIBLE_OBJECTS");
            if(!frozen(c)&&manager&&allows(actor,p,"DG2_EDIT"))allowed.add("EDIT");
            if("APPROVED".equals(c.status)&&manager&&allows(actor,p,"DG2_EDIT")&&allows(actor,p,"PROJECT_MEMBER_MANAGE"))allowed.add("TRANSFER_RESPONSIBILITY");
            if(!frozen(c)&&manager&&allows(actor,p,"DG2_EDIT")&&money&&allows(actor,p,"DELIVERY_BUDGET_EDIT"))allowed.add("EDIT_BUDGET");
            if("APPROVED".equals(c.status)&&money&&allows(actor,p,"DG2_APPROVE")&&snap.policy()!=null&&actor.accountId().equals(snap.policy().policy().finalApproverId()))allowed.add("DECIDE_CHANGE");
            if(!frozen(c)&&!"APPROVED".equals(c.status)&&manager&&allows(actor,p,"DG2_SUBMIT"))allowed.add("SUBMIT");
            if(frozen(c)&&rounds.findById(c.currentRoundId).map(r->r.submittedBy.equals(actor.accountId())).orElse(false)&&allows(actor,p,"DG2_SUBMIT"))allowed.add("WITHDRAW");
            if(frozen(c)&&allows(actor,p,"DG2_REVIEW")&&reviews.findAllByRoundIdOrderByCreatedAtAsc(c.currentRoundId).stream()
                    .anyMatch(r->r.reviewerId.equals(actor.accountId())&&"PENDING".equals(r.status)))allowed.add("REVIEW");
            if(frozen(c)&&allows(actor,p,"DG2_APPROVE")&&snap.policy()!=null&&actor.accountId().equals(snap.policy().policy().finalApproverId()))allowed.add("APPROVE");
            if(!frozen(c)&&allows(actor,p,"DG2_RESOURCE_COMMIT"))allowed.add("RESOURCE_COMMIT");
            if(!frozen(c)&&allows(actor,p,"DG2_EDIT"))allowed.add("HANDLE_FINDINGS");
            if(!frozen(c)&&allows(actor,p,"DG2_REVIEW"))allowed.add("VERIFY_FINDINGS");
        }
        return new Workspace(row(p,c),new CaseView(c.id,c.version,c.status,snap.header(),c.roundNumber,c.baselineVersion,
                snap.handover(),snap.template(),projectPolicy(snap.policy(),money),money,
                snap.policy()==null?List.of():snap.policy().policy().reviewers().stream().map(r->new ReviewAssignment(r.accountId(),r.scope())).toList(),
                snap.policy()==null?null:snap.policy().policy().finalApproverId()),objectFacts,snap.resources(),snap.findings(),checks(actor,c),
            rounds.findAllByCaseIdOrderByRoundNumberDesc(c.id).stream().map(r->roundView(r,money)).toList(),
            baselines.findAllByCaseIdOrderByBaselineVersionDesc(c.id).stream().map(b->new Baseline(b.id,b.baselineVersion,b.snapshotHash,b.approvedBy,b.createdAt,b.reason)).toList(),
            changes.findAllByCaseIdOrderByCreatedAtDesc(c.id).stream().map(change->changeView(change,money)).toList(),people,history.list(c.id),List.copyOf(allowed));
    }
    Snapshot reviewSnapshot(SessionPrincipal actor,UUID projectId,UUID roundId){
        var p=projects.requireReadable(actor,projectId,"DG2_READ");var c=require(projectId);
        var r=rounds.findById(roundId).filter(x->x.caseId.equals(c.id)).orElseThrow(BusinessRules::missing);
        return projectSnapshot(codec.read(r.snapshotJson,Snapshot.class),allows(actor,p,"DELIVERY_BUDGET_READ"));
    }
    Snapshot baselineSnapshot(SessionPrincipal actor,UUID projectId,UUID baselineId){
        var p=projects.requireReadable(actor,projectId,"DG2_READ");var c=require(projectId);
        var b=baselines.findById(baselineId).filter(x->x.caseId.equals(c.id)).orElseThrow(BusinessRules::missing);
        return projectSnapshot(codec.read(b.snapshotJson,Snapshot.class),allows(actor,p,"DELIVERY_BUDGET_READ"));
    }
    List<Revision> revisionHistory(SessionPrincipal actor,UUID projectId,UUID objectId){
        var p=projects.requireReadable(actor,projectId,"DG2_READ");var c=require(projectId);boolean money=allows(actor,p,"DELIVERY_BUDGET_READ");
        return revisions.findAllByCaseIdOrderByCreatedAtDesc(c.id).stream().filter(r->r.objectId.equals(objectId))
            .filter(r->money||!Set.of("BUDGET","POLICY").contains(r.kind)).map(r->new Revision(r.id,r.objectId,r.kind,r.objectVersion,r.beforeJson,r.afterJson,r.actorId,r.createdAt,money?r.reason:null,money?r.impact:null,money?r.basis:null)).toList();
    }
    DeliveryCase require(UUID projectId){return cases.findByProjectId(projectId).orElseThrow(()->conflict("请先开始本项目的立项准备。"));}
    DeliveryCase writable(SessionPrincipal actor,UUID projectId,String permission){
        projects.requireWritable(actor,projectId,permission);var c=require(projectId);
        if(!projects.participant(projectId,actor.accountId()))throw conflict("请由参与原项目且具有相应权限的责任人处理。");
        return c;
    }
    void editable(DeliveryCase c){if(frozen(c))throw conflict("本轮正在评审，请退回或撤回后修改。");}
    void manager(SessionPrincipal actor,DeliveryCase c){if(!c.managerId.equals(actor.accountId()))throw conflict("此项须由本项目的实际项目经理处理。");}
    boolean frozen(DeliveryCase c){return Set.of("SUBMITTED","IN_REVIEW").contains(c.status);}
    void member(UUID projectId,UUID id){access.account(id);if(!projects.participant(projectId,id))throw invalid("ownerId","所选责任人须为原项目的启用成员。");}
    boolean allows(SessionPrincipal a,ProjectDirectory.ProjectContext p,String permission){return access.allows(a,permission,p.authorization());}
    boolean allowsPerson(UUID personId,String permission,UUID projectId){
        try{var a=access.account(personId);if(!projects.participant(projectId,personId))return false;
            var actor=new SessionPrincipal(personId,a.loginName(),a.displayName(),false,false,new UUID(0,0));
            var p=projects.requireReadable(actor,projectId,"DG2_READ");return access.allows(actor,permission,p.authorization());
        }catch(DomainException e){return false;}
    }
    DeliveryObject object(DeliveryCase c,UUID id){return objects.findById(id).filter(o->o.caseId.equals(c.id)).orElseThrow(BusinessRules::missing);}
    void reference(DeliveryCase c,UUID id,String kind){
        if(id==null)return;var o=objects.findById(id).filter(x->x.caseId.equals(c.id)&&x.kind.equals(kind)&&!x.archived).orElseThrow(()->invalid("reference","关联对象不存在、类型错误、已停用或不属于当前项目。"));
        if("STAGE".equals(kind)&&!codec.read(o.contentJson,Content.class).stage().applicable())throw invalid("stageId","请关联适用阶段。");
    }
    void validateReferences(SessionPrincipal actor,DeliveryCase c,Content content){
        switch(content.kind()){
            case "STAGE" -> {var s=content.stage();optionalMember(c,s.ownerId());for(UUID id:s.predecessorIds())reference(c,id,"STAGE");for(UUID id:s.parallelIds())reference(c,id,"STAGE");}
            case "MILESTONE" -> {var m=content.milestone();optionalMember(c,m.ownerId());reference(c,m.stageId(),"STAGE");if(m.contractNodeId()!=null)contracts.requireNode(actor,c.projectId,m.contractNodeId());}
            case "ITEM" -> {var i=content.item();reference(c,i.stageId(),"STAGE");reference(c,i.workPackageId(),"WORK_PACKAGE");reference(c,i.milestoneId(),"MILESTONE");}
            case "WORK_PACKAGE" -> {var w=content.workPackage();member(c.projectId,w.ownerId());member(c.projectId,w.verifierId());reference(c,w.stageId(),"STAGE");w.itemIds().forEach(id->reference(c,id,"ITEM"));w.milestoneIds().forEach(id->reference(c,id,"MILESTONE"));}
            case "PLAN" -> {var p=content.plan();reference(c,p.stageId(),"STAGE");reference(c,p.workPackageId(),"WORK_PACKAGE");p.dependsOnIds().forEach(id->reference(c,id,"PLAN"));}
            case "BUDGET" -> {
                var p=projects.requireReadable(actor,c.projectId,"DG2_READ");access.require(actor,"DELIVERY_BUDGET_EDIT",p.authorization());access.require(actor,"DELIVERY_BUDGET_READ",p.authorization());
                var b=content.budget();b.authorizedStageIds().forEach(id->reference(c,id,"STAGE"));
                for(var l:b.lines()){
                    reference(c,l.stageId(),"STAGE");reference(c,l.workPackageId(),"WORK_PACKAGE");reference(c,l.itemId(),"ITEM");
                    if(l.resourceRequestId()!=null&&!resources.findById(l.resourceRequestId()).filter(r->r.caseId.equals(c.id)&&!"REVOKED".equals(r.status)).isPresent())throw invalid("resourceRequestId","资源申请不属于此项目或已撤回。");
                }
            }
            default -> throw invalid("content","未注册的对象类型。");
        }
    }
    void responsible(SessionPrincipal actor,DeliveryCase c,Content current,Content next){
        if(c.managerId.equals(actor.accountId()))return;
        UUID owner=switch(current.kind()){
            case "STAGE" -> current.stage().ownerId();
            case "WORK_PACKAGE" -> current.workPackage().ownerId();
            case "PLAN" -> ownerOfPackage(c,current.plan().workPackageId());
            case "ITEM" -> ownerOfPackage(c,current.item().workPackageId());
            default -> null;
        };
        if(!actor.accountId().equals(owner))throw conflict("仅项目经理或该对象的实际负责人可维护。");
        if(next!=null){
            UUID nextOwner=switch(next.kind()){
                case "STAGE" -> next.stage().ownerId();case "WORK_PACKAGE" -> next.workPackage().ownerId();
                case "PLAN" -> ownerOfPackage(c,next.plan().workPackageId());case "ITEM" -> ownerOfPackage(c,next.item().workPackageId());default -> null;
            };
            if(!Objects.equals(owner,nextOwner))throw conflict("责任人调整须由项目经理办理。");
            if("PLAN".equals(next.kind())&&!"WORK_PACKAGE".equals(next.plan().kind()))throw conflict("主计划须由项目经理维护。");
        }
    }
    void touch(DeliveryCase c){c.touch();cases.flush();}
    void record(DeliveryCase c,UUID objectId,String kind,long objectVersion,String before,String after,UUID actor,
            String reason,String impact,String basis){
        var r=new DeliveryRevision();r.caseId=c.id;r.objectId=objectId;r.kind=kind;r.objectVersion=objectVersion;r.beforeJson=before;r.afterJson=after;
        r.actorId=actor;r.reason=required(reason,"reason",2000);r.impact=optional(impact,"impact",4000);r.basis=optional(basis,"basis",4000);revisions.saveAndFlush(r);
        history.record(c.id,"DELIVERY_INITIATION","DELIVERY_"+kind+"_UPDATED","维护"+label(kind)+"；对象版本 "+objectVersion+"。",actor);
    }
    Snapshot snapshot(DeliveryCase c){
        return new Snapshot(c.id,c.projectId,c.version,codec.read(c.headerJson,Header.class),c.preparedBy,
            codec.read(c.handoverJson,PackageReference.class),c.templateJson==null?null:codec.read(c.templateJson,PublishedConfiguration.class),
            c.policyJson==null?null:codec.read(c.policyJson,PublishedConfiguration.class),
            objects.findAllByCaseIdOrderByCreatedAtAsc(c.id).stream().map(this::objectFact).toList(),
            resources.findAllByCaseIdOrderByCreatedAtAsc(c.id).stream().map(this::resourceFact).toList(),
            findings.findAllByCaseIdOrderByCreatedAtAsc(c.id).stream().map(this::findingFact).toList());
    }
    Set<UUID> preparers(Snapshot s){
        var ids=new HashSet<UUID>();ids.add(s.preparedBy());s.objects().stream().filter(o->!o.archived()).forEach(o->ids.add(o.preparedBy()));
        s.resources().stream().filter(r->!"REVOKED".equals(r.status())).forEach(r->ids.add(r.preparedBy()));
        s.findings().forEach(f->ids.add(f.preparedBy()));return ids;
    }
    String contentHash(Snapshot s){
        return codec.hash(new Snapshot(s.caseId(),s.projectId(),0,s.header(),s.preparedBy(),s.handover(),s.template(),s.policy(),s.objects(),s.resources(),s.findings()));
    }
    List<Check> checks(SessionPrincipal actor,DeliveryCase c){
        var p=projects.requireReadable(actor,c.projectId,"DG2_READ");var s=snapshot(c);String root="/delivery-initiation/"+c.projectId;
        var result=new ArrayList<Check>();result.add(sourceCheck(actor,c.projectId,s.handover()));
        var reception=new ArrayList<String>();
        if(DeliveryRules.blank(s.header().scopeAcceptance()))reception.add("请确认接收的商务范围。");
        if(DeliveryRules.blank(s.header().acceptanceCriteria()))reception.add("请确认验收边界。");
        if(DeliveryRules.blank(s.header().timeConstraints()))reception.add("请确认关键时间约束。");
        if(DeliveryRules.blank(s.header().handoverFollowups()))reception.add("请逐项确认移交遗留及处理方式；没有遗留时请明确说明。");
        if(!s.header().projectType().equals(s.handover().projectType()))reception.add("项目类型与接收的移交包不一致。");
        result.add(check("RECEPTION","商务范围接收",reception,root+"?section=overview"));
        result.add(check("TEAM","团队与资源承诺",teamProblems(c,s),root+"?section=resources"));
        result.add(check("STAGES","项目阶段与模板",DeliveryRules.stageProblems(s.objects(),s.template()==null?null:s.template().template()),"/projects/"+c.projectId+"?tab=stages"));
        var planProblems=new ArrayList<>(DeliveryRules.planProblems(s.objects()));boolean planRestricted=false;
        for(var o:DeliveryRules.selected(s.objects(),"MILESTONE"))if(o.content().milestone().contractNodeId()!=null){
            try{contracts.requireNode(actor,c.projectId,o.content().milestone().contractNodeId());}
            catch(DomainException e){if(restricted(e)){planRestricted=true;planProblems.add("当前账号无法完整核验引用的合同节点。");}else planProblems.add(o.content().title()+"："+e.getMessage());}
        }
        result.add(new Check("PLAN","里程碑与主计划",planRestricted?"RESTRICTED":planProblems.isEmpty()?"PASS":"BLOCKED",planProblems,"/projects/"+c.projectId+"?tab=milestones"));
        var scope=new ArrayList<>(DeliveryRules.scopeProblems(s.objects()));boolean workRestricted=false;
        for(var o:DeliveryRules.selected(s.objects(),"WORK_PACKAGE")){
            try{
                var w=work.require(actor,c.projectId,o.id());var content=o.content().workPackage();
                if(!w.title().equals(content.title())||!w.ownerId().equals(content.ownerId())||!w.verifierId().equals(content.verifierId())
                    ||!Objects.equals(w.dueDate(),content.endsOn())||(!"APPROVED".equals(c.status)&&!"OPEN".equals(w.status()))
                    ||"APPROVED".equals(c.status)&&!"BASELINED".equals(w.deliveryState()))scope.add(content.title()+"：原工作包责任、日期或基线状态已变化。");
            }catch(DomainException e){if(restricted(e)){workRestricted=true;scope.add("当前账号无法完整核验原工作包。");}else scope.add(e.getMessage());}
        }
        result.add(new Check("SCOPE","清单与工作包",workRestricted?"RESTRICTED":scope.isEmpty()?"PASS":"BLOCKED",scope,"/projects/"+c.projectId+"?tab=items"));
        boolean money=allows(actor,p,"DELIVERY_BUDGET_READ");
        result.add(money?check("BUDGET","实施预算与范围",DeliveryRules.budgetProblems(s.objects(),s.resources(),LocalDate.now()),"/projects/"+c.projectId+"?tab=budget")
            :new Check("BUDGET","实施预算与范围","RESTRICTED",List.of("当前账号没有预算明细查看权限，无法核验覆盖与额度。"),"/projects/"+c.projectId+"?tab=budget"));
        var followups=new ArrayList<String>();
        for(var f:s.findings()){
            if("CLOSED".equals(f.status()))continue;
            if(f.blocking()&&!"CLOSED".equals(f.status()))followups.add(f.finding().title()+"：阻断事项尚未独立验证关闭。");
            if(!f.blocking()&&!"CLOSED".equals(f.status())&&f.finding().dueDate().isBefore(LocalDate.now()))followups.add(f.finding().title()+"：遗留已逾期，请先明确可执行的期限和升级处理。");
            try{member(c.projectId,f.finding().ownerId());member(c.projectId,f.finding().verifierId());member(c.projectId,f.finding().escalationOwnerId());}
            catch(DomainException e){followups.add(f.finding().title()+"：当前责任或验证人员不可用。");}
        }
        result.add(check("FINDINGS","风险与遗留闭环",followups,root+"?section=findings"));
        var authority=authorityProblems(c,s);
        if(s.template()!=null&&!s.template().template().projectTypes().contains(s.header().projectType()))authority.add("阶段模板不适用当前项目类型。");
        if(!money)result.add(new Check("AUTHORITY","版本与评审授权","RESTRICTED",List.of("评审适用规则涉及预算，请由具备完整核验权限的人员提交。"),root+"?section=review"));
        else result.add(check("AUTHORITY","版本与评审授权",authority,root+"?section=review"));
        return List.copyOf(result);
    }
    List<String> authorityProblems(DeliveryCase c,Snapshot s){
        var problems=new ArrayList<String>();var prep=preparers(s);
        if(!allowsPerson(s.header().projectManagerId(),"DG2_SUBMIT",c.projectId))problems.add("项目经理当前不具备提交权限。");
        if(s.policy()==null){problems.add("尚未选择适用的已发布评审规则。");return problems;}
        var policy=s.policy().policy();var total=DeliveryRules.budgetTotal(s.objects());
        if(!policy.projectTypes().contains(s.header().projectType())||!policy.riskLevels().contains(s.header().riskLevel())
            ||policy.minimumBudget()!=null&&total.compareTo(policy.minimumBudget())<0||policy.maximumBudget()!=null&&total.compareTo(policy.maximumBudget())>0)problems.add("评审规则不适用当前项目类型、风险或预算范围。");
        for(var reviewer:policy.reviewers()){
            if(prep.contains(reviewer.accountId())||!allowsPerson(reviewer.accountId(),"DG2_REVIEW",c.projectId))problems.add("必要会签人须为有当前权限的独立项目成员。");
            if("FINANCIAL".equals(reviewer.scope())&&!allowsPerson(reviewer.accountId(),"DELIVERY_BUDGET_READ",c.projectId))problems.add("财务会签人缺少必要的预算阅读权限。");
        }
        if(prep.contains(policy.finalApproverId())||!allowsPerson(policy.finalApproverId(),"DG2_APPROVE",c.projectId)
            ||!allowsPerson(policy.finalApproverId(),"DELIVERY_BUDGET_READ",c.projectId))problems.add("最终批准人须具有当前公司批准权限、预算阅读权限并独立于申报准备者。");
        return problems;
    }
    List<String> teamProblems(DeliveryCase c,Snapshot s){
        return teamProblems(c,s,true);
    }
    List<String> teamProblems(DeliveryCase c,Snapshot s,boolean checkLiveAllocations){
        var problems=new ArrayList<String>();
        var completed="APPROVED".equals(c.status)?work.completedPackageIds(c.projectId):Set.<UUID>of();
        try{member(c.projectId,s.header().projectManagerId());member(c.projectId,s.header().technicalLeadId());}catch(DomainException e){problems.add("项目经理或技术负责人尚未明确为有效成员。");}
        for(var o:s.objects())if(!o.archived()){
            var content=o.content();
            try{
                if(content.stage()!=null&&content.stage().applicable())member(c.projectId,content.stage().ownerId());
                if(content.milestone()!=null)member(c.projectId,content.milestone().ownerId());
                if(content.workPackage()!=null&&!completed.contains(o.id())){
                    var w=content.workPackage();member(c.projectId,w.ownerId());member(c.projectId,w.verifierId());
                    if(!allowsPerson(w.ownerId(),"DG2_EDIT",c.projectId)||!allowsPerson(w.ownerId(),"WORK_EDIT",c.projectId)
                        ||!allowsPerson(w.verifierId(),"WORK_REVIEW",c.projectId))problems.add(w.title()+"：负责人或独立验证人当前缺少执行权限。");
                }
            }catch(DomainException e){problems.add(content.title()+"：责任成员尚未齐备或已失效。");}
        }
        var budgets=DeliveryRules.selected(s.objects(),"BUDGET");
        var phased=budgets.size()==1&&"PHASED".equals(budgets.getFirst().content().budget().mode())?Set.copyOf(budgets.getFirst().content().budget().authorizedStageIds()):null;
        for(var o:DeliveryRules.selected(s.objects(),"WORK_PACKAGE")){
            if(completed.contains(o.id()))continue;
            var w=o.content().workPackage();if(phased!=null&&!phased.contains(w.stageId()))continue;
            var requested=s.resources().stream().filter(r->o.id().equals(r.request().workPackageId())&&!"REVOKED".equals(r.status())).toList();
            if(requested.isEmpty())problems.add(w.title()+"：首段执行资源尚未申请与承诺。");
            for(var r:requested){
                if(!Set.of("COMMITTED","RESOLVED").contains(r.status()))problems.add(w.title()+"：资源申请尚未获得明确承诺。");
                if(!DeliveryRules.within(r.request().startsOn(),r.request().endsOn(),w.startsOn(),w.endsOn()))problems.add(w.title()+"：资源窗口超出工作包计划。");
                if(!allowsPerson(r.request().committerId(),"DG2_RESOURCE_COMMIT",c.projectId))problems.add(w.title()+"：资源承诺人当前权限已失效。");
                try{member(c.projectId,r.request().personId());requireCommitterOrganization(r.request());}catch(DomainException e){problems.add(w.title()+"：资源人员或部门授权关系已变化。");}
                if(checkLiveAllocations&&r.commitment()!=null&&peakHours(r.request(),r.id()).compareTo(r.commitment().dailyCapacity())>0
                    &&(!"RESOLVED".equals(r.status())||!Objects.equals(overlapHash(r.request(),r.id()),r.overlapHash())))
                    problems.add(w.title()+"：新增重叠资源超出已签认容量，请重新协调。");
            }
        }
        return List.copyOf(problems);
    }
    void requireCommitterOrganization(ResourceRequest r){
        var person=access.account(r.personId());var committer=access.account(r.committerId());
        if(!r.personId().equals(r.committerId())&&!Objects.equals(person.organizationUnitId(),committer.organizationUnitId()))
            throw conflict("指定承诺人须对资源人员所在部门负责；跨部门签认不能替代部门承诺。");
    }
    java.math.BigDecimal peakHours(ResourceRequest request,UUID excluding){
        var boundaries=new TreeMap<LocalDate,java.math.BigDecimal>();addRange(boundaries,request.startsOn(),request.endsOn(),request.dailyHours());
        for(var r:resources.findAllByPersonIdAndStartsOnLessThanEqualAndEndsOnGreaterThanEqual(request.personId(),request.endsOn(),request.startsOn())){
            if(r.id.equals(excluding)||!Set.of("COMMITTED","RESOLVED").contains(r.status))continue;
            addRange(boundaries,r.startsOn.isBefore(request.startsOn())?request.startsOn():r.startsOn,r.endsOn.isAfter(request.endsOn())?request.endsOn():r.endsOn,r.dailyHours);
        }
        var used=java.math.BigDecimal.ZERO;var peak=used;for(var delta:boundaries.values()){used=used.add(delta);peak=peak.max(used);}return peak;
    }
    String overlapHash(ResourceRequest request,UUID excluding){
        var allocations=resources.findAllByPersonIdAndStartsOnLessThanEqualAndEndsOnGreaterThanEqual(request.personId(),request.endsOn(),request.startsOn()).stream()
            .filter(r->!r.id.equals(excluding)&&Set.of("COMMITTED","RESOLVED").contains(r.status)).sorted(Comparator.comparing(r->r.id))
            .map(r->List.of(r.id.toString(),r.startsOn.toString(),r.endsOn.toString(),r.dailyHours.stripTrailingZeros().toPlainString())).toList();
        return codec.hash(allocations);
    }
    private void addRange(TreeMap<LocalDate,java.math.BigDecimal> points,LocalDate start,LocalDate end,java.math.BigDecimal hours){
        points.merge(start,hours,java.math.BigDecimal::add);points.merge(end.plusDays(1),hours.negate(),java.math.BigDecimal::add);
    }
    private Check sourceCheck(SessionPrincipal actor,UUID projectId,PackageReference expected){
        try{
            var actual=handover.requireCurrentPackage(actor,projectId);
            if(expected!=null&&(!expected.id().equals(actual.id())||!expected.hash().equals(actual.hash())))
                return check("HANDOVER","当前 DG-01 移交包",List.of("当前移交包已变化，请明确重新接收最新来源。"),"/projects/"+projectId+"?tab=handover");
            return check("HANDOVER","当前 DG-01 移交包",List.of(),"/projects/"+projectId+"?tab=handover");
        }catch(DomainException e){return new Check("HANDOVER","当前 DG-01 移交包",restricted(e)?"RESTRICTED":"BLOCKED",
            List.of(restricted(e)?"当前账号无法完整核验移交来源。":e.getMessage()),"/projects/"+projectId+"?tab=handover");}
    }
    private boolean eligibleForQueue(SessionPrincipal actor,UUID projectId){
        try{return handover.approvedPackageSummary(actor,projectId).isPresent();}catch(DomainException e){return false;}
    }
    private Check check(String code,String title,List<String> problems,String href){return new Check(code,title,problems.isEmpty()?"PASS":"BLOCKED",problems,href);}
    private boolean restricted(DomainException e){return e.status().value()==403||e.status().value()==404;}
    private UUID ownerOfPackage(DeliveryCase c,UUID id){if(id==null)return null;var o=object(c,id);return "WORK_PACKAGE".equals(o.kind)?codec.read(o.contentJson,Content.class).workPackage().ownerId():null;}
    private void optionalMember(DeliveryCase c,UUID id){if(id!=null)member(c.projectId,id);}
    ObjectFact objectFact(DeliveryObject o){return new ObjectFact(o.id,o.version,o.kind,codec.read(o.contentJson,Content.class),o.preparedBy,o.archived,o.baselineVersion);}
    ResourceFact resourceFact(DeliveryResource r){return new ResourceFact(r.id,r.version,codec.read(r.requestJson,ResourceRequest.class),r.status,
        r.commitmentJson==null?null:codec.read(r.commitmentJson,Commitment.class),r.committedBy,r.committedAt,r.preparedBy,r.overlapHash);}
    FindingFact findingFact(DeliveryFinding f){return new FindingFact(f.id,f.version,codec.read(f.contentJson,Finding.class),f.status,f.blocking,
        f.preparedBy,f.evidence,f.evidenceBy,f.evidenceAt,f.verification,f.verifiedBy,f.verifiedAt);}
    Change changeView(DeliveryChange c,boolean money){return new Change(c.id,c.version,c.objectId,c.expectedObjectVersion,c.status,codec.read(c.contentJson,Content.class),c.archiveRequested,
        c.submittedBy,money?c.reason:null,money?c.impact:null,money?c.basis:null,c.decidedBy,c.decidedAt,money?c.decision:null);}
    Round roundView(DeliveryRound r,boolean budgetReadable){return new Round(r.id,r.version,r.roundNumber,r.status,r.snapshotHash,r.submittedBy,r.createdAt,
        budgetReadable?r.submissionNote:null,r.decidedBy,r.decidedAt,budgetReadable?r.decisionNote:null,
        reviews.findAllByRoundIdOrderByCreatedAtAsc(r.id).stream().map(v->new Review(v.id,v.version,v.reviewerId,v.scope,v.status,
            budgetReadable||!"FINANCIAL".equals(v.scope)?v.comment:null,v.reviewedAt)).toList());}
    private Row row(ProjectDirectory.ProjectContext p,DeliveryCase c){
        var open=c==null?List.<DeliveryFinding>of():findings.findAllByCaseIdOrderByCreatedAtAsc(c.id).stream().filter(f->!"CLOSED".equals(f.status)).toList();
        return new Row(p.id(),p.code(),p.name(),p.customerName(),p.mainStage(),p.status(),c==null?"NOT_STARTED":c.status,c==null?null:c.managerId,
            c==null?null:access.name(c.managerId),c==null?0:c.roundNumber,c==null?0:c.baselineVersion,open.size(),
            (int)open.stream().filter(f->codec.read(f.contentJson,Finding.class).dueDate().isBefore(LocalDate.now())).count(),c==null?null:c.updatedAt);
    }
    Snapshot projectSnapshot(Snapshot s,boolean money){return new Snapshot(s.caseId(),s.projectId(),s.caseVersion(),s.header(),s.preparedBy(),s.handover(),s.template(),
        projectPolicy(s.policy(),money),projectObjects(s.objects(),money),s.resources(),s.findings());}
    private List<ObjectFact> projectObjects(List<ObjectFact> facts,boolean money){return facts.stream().filter(o->money||!"BUDGET".equals(o.kind())).toList();}
    private PublishedConfiguration projectPolicy(PublishedConfiguration c,boolean money){return c==null||money?c:new PublishedConfiguration(c.id(),c.seriesId(),c.edition(),c.name(),c.kind(),null,null,c.snapshotHash());}
    private List<Person> people(Snapshot s){
        var ids=new LinkedHashSet<UUID>();ids.add(s.header().projectManagerId());ids.add(s.header().technicalLeadId());ids.add(s.preparedBy());ids.add(s.handover().receiverId());
        for(var o:s.objects()){var c=o.content();ids.add(o.preparedBy());if(c.stage()!=null)ids.add(c.stage().ownerId());if(c.milestone()!=null)ids.add(c.milestone().ownerId());
            if(c.workPackage()!=null){ids.add(c.workPackage().ownerId());ids.add(c.workPackage().verifierId());}}
        for(var r:s.resources()){ids.add(r.request().personId());ids.add(r.request().committerId());}
        for(var f:s.findings()){ids.add(f.finding().ownerId());ids.add(f.finding().verifierId());ids.add(f.finding().escalationOwnerId());}
        if(s.policy()!=null){ids.add(s.policy().policy().finalApproverId());s.policy().policy().reviewers().forEach(r->ids.add(r.accountId()));}
        return ids.stream().filter(Objects::nonNull).map(id->new Person(id,access.name(id))).toList();
    }
    @EventListener void preventRemoval(ProjectDirectory.MemberRemovalRequested event){
        cases.findByProjectId(event.projectId()).ifPresent(c->{
            var s=snapshot(c);var current=new HashSet<UUID>();current.add(s.header().projectManagerId());current.add(s.header().technicalLeadId());
            var completed=work.completedPackageIds(c.projectId);
            for(var o:s.objects())if(!o.archived()){
                var body=o.content();if(body.stage()!=null&&body.stage().applicable())current.add(body.stage().ownerId());
                if(body.milestone()!=null)current.add(body.milestone().ownerId());
                if(body.workPackage()!=null&&!completed.contains(o.id())){current.add(body.workPackage().ownerId());current.add(body.workPackage().verifierId());}
            }
            for(var r:s.resources())if(!"REVOKED".equals(r.status())&&!r.request().endsOn().isBefore(LocalDate.now())){current.add(r.request().personId());current.add(r.request().committerId());}
            for(var f:s.findings())if(!"CLOSED".equals(f.status())){current.add(f.finding().ownerId());current.add(f.finding().verifierId());current.add(f.finding().escalationOwnerId());}
            if(!"APPROVED".equals(c.status)&&s.policy()!=null){current.add(s.policy().policy().finalApproverId());s.policy().policy().reviewers().forEach(r->current.add(r.accountId()));}
            if(current.contains(event.accountId()))
                throw conflict("该成员仍在交付责任、资源或评审分工中，请先完成责任交接。");
        });
    }
    static String label(String kind){return switch(kind){case "STAGE"->"项目阶段";case "MILESTONE"->"里程碑";case "ITEM"->"交付清单";
        case "WORK_PACKAGE"->"专业工作包";case "PLAN"->"主计划";case "BUDGET"->"实施预算";case "RESOURCE"->"资源申请";case "FINDING"->"遗留事项";default->"立项准备";};}
}
