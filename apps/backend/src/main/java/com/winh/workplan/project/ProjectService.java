package com.winh.workplan.project;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.project.ProjectCommands.*;
import static com.winh.workplan.project.ProjectViews.*;
import java.util.*;
import com.winh.workplan.business.*;
import com.winh.workplan.crm.CrmDirectory;
import com.winh.workplan.iam.authorization.ProjectRoleAssignments;
import com.winh.workplan.iam.authorization.ResourceContext;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.PageResponse;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly = true)
public class ProjectService implements ProjectDirectory {
    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final CrmDirectory crm;
    private final BusinessAccess access;
    private final BusinessHistory history;
    private final ProjectRoleAssignments roles;
    private final ApplicationEventPublisher events;
    public ProjectService(ProjectRepository projects, ProjectMemberRepository members, CrmDirectory crm,
            BusinessAccess access, BusinessHistory history, ProjectRoleAssignments roles, ApplicationEventPublisher events) {
        this.projects = projects; this.members = members; this.crm = crm; this.access = access;
        this.history = history; this.roles = roles; this.events = events;
    }
    public PageResponse<ProjectView> list(SessionPrincipal actor, String q, String status, int page, int size) {
        var visible = projects.findAll(Sort.by(Sort.Direction.DESC, "updatedAt")).stream()
            .filter(p -> access.allows(actor, "PROJECT_READ", context(actor, p)))
            .filter(p -> status == null || status.isBlank() || status.equals(p.status))
            .filter(p -> matches(q, p.name, p.code)).map(this::view).toList();
        return page(visible, page, size);
    }
    public ProjectDetail detail(SessionPrincipal actor, UUID id) {
        var p = projects.findById(id).orElseThrow(BusinessRules::missing);
        access.readable(actor, "PROJECT_READ", context(actor, p));
        var actions = access.actions(actor, context(actor, p), "PROJECT_EDIT", "PROJECT_MEMBER_MANAGE",
            "PRESALES_READ", "PRESALES_EDIT", "PRESALES_REVIEW", "REQUIREMENT_READ", "REQUIREMENT_CREATE",
            "REQUIREMENT_EDIT", "REQUIREMENT_VERIFY", "CONTRACT_READ", "CONTRACT_EDIT", "FILE_READ", "HANDOVER_READ", "EARLY_START_READ", "DG2_READ", "DELIVERY_BUDGET_READ", "DELIVERY_EXECUTION_READ", "WORK_READ", "FINANCE_READ", "FINANCE_FORECAST_EDIT", "FINANCE_INCOME_SUBMIT", "FINANCE_INCOME_CONFIRM");
        if ("CLOSED".equals(p.status)) actions = actions.stream().filter(a -> a.endsWith("_READ")).toList();
        var scopedActions = new ArrayList<>(actions);
        if (crm.canReadOpportunity(actor, p.opportunityId)) scopedActions.add("CRM_OPPORTUNITY_READ");
        return new ProjectDetail(view(p), memberViews(p), history.list(id), scopedActions);
    }
    @Transactional
    public ProjectDetail create(SessionPrincipal actor, CreateProject input) {
        var opportunity = crm.lockForProject(actor, input.opportunityId());
        var reservation = access.reserve(actor, "project.create", input.requestId(), input);
        if (reservation.replayed()) return detail(actor, reservation.targetId());
        if (opportunity.projectId() != null) {
            access.complete(reservation, opportunity.projectId()); return detail(actor, opportunity.projectId());
        }
        access.account(input.presalesOwnerId());
        if (access.people(actor).stream().noneMatch(a -> a.id().equals(input.presalesOwnerId())))
            throw invalid("presalesOwnerId", "所选售前负责人不在可选人员范围内。");
        var p = new ProjectSpace(); p.code = "PRJ-" + p.id.toString().substring(0, 8).toUpperCase(Locale.ROOT);
        p.opportunityId = opportunity.id(); p.name = opportunity.title(); p.background = opportunity.background();
        p.salesOwnerId = opportunity.ownerAccountId(); p.presalesOwnerId = input.presalesOwnerId();
        p.organizationUnitId = opportunity.organizationUnitId(); projects.saveAndFlush(p);
        addInitialMember(p.id, p.salesOwnerId);
        if (!p.salesOwnerId.equals(p.presalesOwnerId)) addInitialMember(p.id, p.presalesOwnerId);
        roles.initializeOwners(p.id, p.salesOwnerId, p.presalesOwnerId, actor.accountId());
        crm.bindProject(opportunity.id(), p.id);
        events.publishEvent(new ProjectCreated(p.id, p.salesOwnerId, p.presalesOwnerId, actor.accountId()));
        history.record(p.id, "PROJECT", "PROJECT_CREATED", "由原商机创建售前空间；待 SG-01 投入立项。", actor.accountId());
        access.complete(reservation, p.id); return detail(actor, p.id);
    }
    @Transactional
    public ProjectDetail edit(SessionPrincipal actor, UUID id, EditProject input) {
        requireWritable(actor, id, "PROJECT_EDIT"); var p = projects.findById(id).orElseThrow(BusinessRules::missing);
        var reservation = access.reserve(actor, "project.edit:" + id, input.requestId(), input);
        if (reservation.replayed()) return detail(actor, id);
        version(p, input.version()); p.name = required(input.name(), "name", 160);
        if (!"PRESALES".equals(p.mainStage) && !Objects.equals(p.focus, input.focus())) throw invalid("focus", "交付重点请在项目阶段中维护。");
        p.focus = choice(input.focus(), "focus", "NOT_SET", "SURVEY", "REQUIREMENTS", "SOLUTION", "ESTIMATE", "QUOTATION", "BIDDING", "HANDOVER");
        p.background = optional(input.background(), "background", 8000); p.touch(); projects.flush();
        history.record(id, "PROJECT", "PROJECT_UPDATED", "更新项目概览与当前重点。", actor.accountId());
        access.complete(reservation, id); return detail(actor, id);
    }
    @Transactional
    public ProjectDetail saveMember(SessionPrincipal actor, UUID id, SaveMember input) {
        var ctx = requireWritable(actor, id, "PROJECT_MEMBER_MANAGE");
        var p = projects.findById(id).orElseThrow(BusinessRules::missing);
        var reservation = access.reserve(actor, "project.member:" + id, input.requestId(), input);
        if (reservation.replayed()) return detail(actor, id);
        version(p, input.version()); access.account(input.accountId());
        String reason = required(input.reason(), "reason", 1000);
        if (!input.active()) {
            if (p.salesOwnerId.equals(input.accountId()) || p.presalesOwnerId.equals(input.accountId()))
                throw conflict("请先完成责任商务/售前负责人的交接，再移除该成员。");
            events.publishEvent(new MemberRemovalRequested(id, input.accountId()));
        }
        List<String> codes = input.active() ? input.roleCodes().stream().distinct().toList() : List.of();
        if (input.active() && codes.isEmpty()) throw invalid("roleCodes", "启用成员至少选择一个项目角色。");
        roles.replace(actor, ctx.authorization(), input.accountId(), codes);
        var m = members.findByProjectIdAndAccountId(id, input.accountId()).orElseGet(ProjectMember::new);
        m.projectId = id; m.accountId = input.accountId(); m.active = input.active();
        m.roleCodes = String.join(",", codes); m.changeReason = reason; m.touch(); members.saveAndFlush(m);
        p.touch(); projects.flush();
        history.record(id, "PROJECT", "PROJECT_MEMBER_CHANGED", "成员 " + access.name(m.accountId) + (m.active ? " 角色：" + m.roleCodes : " 已移除") + "；" + reason, actor.accountId());
        access.complete(reservation, id); return detail(actor, id);
    }
    @Override @Transactional(readOnly=true,noRollbackFor=com.winh.workplan.iam.shared.DomainException.class)
    public ProjectContext requireReadable(SessionPrincipal actor, UUID id, String permission) {
        if (id == null) throw invalid("projectId", "请选择项目空间。");
        var p = projects.findById(id).orElseThrow(BusinessRules::missing);
        access.readable(actor, "PROJECT_READ", context(actor, p)); access.readable(actor, permission, context(actor, p)); return summary(actor, p);
    }
    @Override @Transactional public ProjectContext requireWritable(SessionPrincipal actor, UUID id, String permission) {
        if (id == null) throw invalid("projectId", "请选择项目空间。");
        var p = projects.lockById(id).orElseThrow(BusinessRules::missing);
        access.readable(actor, "PROJECT_READ", context(actor, p)); access.require(actor, permission, context(actor, p));
        if ("CLOSED".equals(p.status)) throw conflict("项目已关闭，当前空间仅可查看。请从原商机受控重开。");
        return summary(actor, p);
    }
    @Override public List<ProjectContext> visible(SessionPrincipal actor, String permission) {
        return projects.findAll(Sort.by(Sort.Direction.DESC, "updatedAt")).stream()
            .filter(p -> access.allows(actor, "PROJECT_READ", context(actor, p)) && access.allows(actor, permission, context(actor, p)))
            .map(p -> summary(actor, p)).toList();
    }
    @Override public boolean participant(UUID projectId, UUID accountId) {
        return members.existsByProjectIdAndAccountIdAndActiveTrue(projectId, accountId);
    }
    @Override public MemberRoles memberRoles(SessionPrincipal actor,UUID projectId,UUID accountId){
        var p=requireReadable(actor,projectId,"PROJECT_READ");
        var m=members.findByProjectIdAndAccountId(projectId,accountId).filter(x->x.active).orElseThrow(BusinessRules::missing);
        return new MemberRoles(accountId,m.version,List.of(m.roleCodes.split(",")),p.salesOwnerId().equals(accountId)||p.presalesOwnerId().equals(accountId));
    }
    @Override @Transactional public void validateRoleChanges(SessionPrincipal actor,UUID projectId,List<RoleChange> changes){
        var context=requireWritable(actor,projectId,"PROJECT_MEMBER_MANAGE");
        if(changes==null||changes.size()!=2||changes.stream().map(RoleChange::accountId).distinct().count()!=2)throw invalid("permissions","交接须明确原、新两名成员的角色清单。");
        for(var change:changes){
            var m=members.findByProjectIdAndAccountId(projectId,change.accountId()).filter(x->x.active).orElseThrow(BusinessRules::missing);
            version(m,change.expectedVersion());var current=memberRoles(actor,projectId,change.accountId());
            if(change.roleCodes()==null)throw invalid("permissions","请明确拟保留或回收的角色。");
            if(change.roleCodes().isEmpty()&&current.originalOwner())throw conflict("该成员仍担任原商务/售前责任，本次不能移除；请明确保留必要项目角色。");
            if(!new HashSet<>(current.roleCodes()).equals(new HashSet<>(change.roleCodes())))roles.validateReplacement(actor,context.authorization(),change.roleCodes());
        }
    }
    @Override @Transactional public void applyRoleChanges(SessionPrincipal actor,UUID projectId,List<RoleChange> changes,String reason){
        validateRoleChanges(actor,projectId,changes);var context=requireWritable(actor,projectId,"PROJECT_MEMBER_MANAGE");
        // Incoming grants precede outgoing revocations; the caller has already moved all live responsibilities.
        for(var change:changes){
            var m=members.findByProjectIdAndAccountId(projectId,change.accountId()).orElseThrow(BusinessRules::missing);
            if(new HashSet<>(List.of(m.roleCodes.split(","))).equals(new HashSet<>(change.roleCodes())))continue;
            if(change.roleCodes().isEmpty())events.publishEvent(new MemberRemovalRequested(projectId,change.accountId()));
            roles.replace(actor,context.authorization(),change.accountId(),change.roleCodes());
            m.roleCodes=String.join(",",change.roleCodes().stream().distinct().toList());m.active=!change.roleCodes().isEmpty();m.changeReason=required(reason,"reason",1000);m.touch();
            history.record(projectId,"PROJECT","PROJECT_MEMBER_TRANSFERRED","责任交接同步项目角色："+access.name(m.accountId)+"；"+(m.active?m.roleCodes:"已移除")+"。",actor.accountId());
        }
        members.flush();var p=projects.findById(projectId).orElseThrow(BusinessRules::missing);p.touch();projects.flush();
    }
    @Override @Transactional public void activate(UUID id) {
        var p = projects.lockById(id).orElseThrow(BusinessRules::missing);
        if ("CLOSED".equals(p.status)) throw conflict("已关闭项目不能通过投入立项。");
        if ("PENDING_INITIATION".equals(p.status)) { p.status = "ACTIVE"; p.touch(); projects.flush(); }
    }
    @Override @Transactional public void activateDelivery(UUID id, UUID approvedBy, UUID baselineId) {
        var p=projects.lockById(id).orElseThrow(BusinessRules::missing);
        if (!"ACTIVE".equals(p.status) || !"PRESALES".equals(p.mainStage))
            throw conflict("仅在售前阶段的有效项目可通过交付立项。");
        p.mainStage="DELIVERY";p.focus="NOT_SET";p.touch();projects.flush();
        history.record(id,"PROJECT","PROJECT_DELIVERY_ACTIVATED","DG-02 已批准原项目 V1；基线 "+baselineId+"。",approvedBy);
    }
    @EventListener @Transactional
    public void outcomeChanged(CrmDirectory.OpportunityResultChanged event) {
        if (event.projectId() == null) return;
        var p = projects.lockById(event.projectId()).orElseThrow(BusinessRules::missing);
        if (!"PRESALES".equals(p.mainStage) && "CLOSED".equals(event.status()))
            throw conflict("已进入交付的项目不能通过售前结果关闭。");
        if ("CLOSED".equals(event.status())) { p.statusBeforeClose = p.status; p.status = "CLOSED"; }
        else if ("CLOSED".equals(p.status)) { p.status = p.statusBeforeClose == null ? "PENDING_INITIATION" : p.statusBeforeClose; }
        p.touch(); projects.flush();
        history.record(p.id, "PROJECT", "PROJECT_OUTCOME_SYNCED", "商机结果 " + event.result() + "；项目状态 " + p.status, event.actorId());
    }
    private void addInitialMember(UUID id, UUID account) {
        var m = new ProjectMember(); m.projectId = id; m.accountId = account; m.roleCodes = "PROJECT_OWNER";
        m.changeReason = "从商机创建空间时初始化责任成员。"; members.saveAndFlush(m);
    }
    private ResourceContext context(SessionPrincipal actor, ProjectSpace p) {
        return new ResourceContext(p.salesOwnerId, p.organizationUnitId, p.id, p.id.toString(),
            participant(p.id, actor.accountId()), true, true, true);
    }
    private ProjectContext summary(SessionPrincipal actor, ProjectSpace p) {
        var o = crm.reference(p.opportunityId);
        return new ProjectContext(p.id, p.code, p.name, p.salesOwnerId, p.presalesOwnerId, p.status, p.mainStage, context(actor, p), p.opportunityId, o.customerId(), o.customerName());
    }
    private ProjectView view(ProjectSpace p) {
        var o = crm.reference(p.opportunityId);
        return new ProjectView(p.id, p.version, p.code, p.name, p.opportunityId, o.customerId(), o.customerName(),
            p.salesOwnerId, access.name(p.salesOwnerId), p.presalesOwnerId, access.name(p.presalesOwnerId),
            p.mainStage, p.focus, p.status, o.result(), o.procurementMethod(), p.background, p.updatedAt);
    }
    private List<MemberView> memberViews(ProjectSpace p) {
        return members.findAllByProjectIdOrderByCreatedAtAsc(p.id).stream().map(m -> new MemberView(m.id, m.accountId,
            access.name(m.accountId), m.roleCodes.isBlank() ? List.of() : List.of(m.roleCodes.split(",")), m.active,
            p.salesOwnerId.equals(m.accountId), p.presalesOwnerId.equals(m.accountId), m.version)).toList();
    }
}
