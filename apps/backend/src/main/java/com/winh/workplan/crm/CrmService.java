package com.winh.workplan.crm;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.crm.CrmCommands.*;
import static com.winh.workplan.crm.CrmViews.*;

import com.winh.workplan.business.*;
import com.winh.workplan.iam.authorization.ResourceContext;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.PageResponse;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CrmService implements CrmDirectory {
    private final CustomerRepository customers;
    private final ContactRepository contacts;
    private final OpportunityRepository opportunities;
    private final OpportunityActivityRepository activities;
    private final BusinessAccess access;
    private final BusinessHistory history;
    private final ApplicationEventPublisher publisher;
    public CrmService(CustomerRepository customers, ContactRepository contacts, OpportunityRepository opportunities,
            OpportunityActivityRepository activities, BusinessAccess access, BusinessHistory history,
            ApplicationEventPublisher publisher) {
        this.customers = customers; this.contacts = contacts; this.opportunities = opportunities;
        this.activities = activities; this.access = access; this.history = history; this.publisher = publisher;
    }

    public PageResponse<CustomerView> customers(SessionPrincipal actor, String q, String status, int page, int size) {
        return page(customers.findAll(Sort.by(Sort.Direction.DESC, "updatedAt")).stream()
            .filter(c -> access.allows(actor, "CRM_CUSTOMER_READ", context(c)))
            .filter(c -> status == null || status.isBlank() || status.equals(c.status))
            .filter(c -> matches(q, c.name, c.shortName, c.identifier, c.code))
            .map(this::view).toList(), page, size);
    }

    public List<CustomerView> duplicates(SessionPrincipal actor, String q, String identifier) {
        if (normalized(q).length() < 2 && normalized(identifier).isEmpty()) return List.of();
        return customers.findAll().stream().filter(c -> !"MERGED".equals(c.status))
            .filter(c -> access.allows(actor, "CRM_CUSTOMER_READ", context(c)))
            .filter(c -> (!normalized(identifier).isEmpty() && normalized(identifier).equals(normalized(c.identifier)))
                || (!normalized(q).isEmpty() && (c.normalizedName.contains(normalized(q)) || normalized(q).contains(c.normalizedName))))
            .limit(10).map(this::view).toList();
    }

    public CustomerDetail customer(SessionPrincipal actor, UUID id) {
        var c = customerRecord(actor, id);
        boolean canReadContacts = access.allows(actor, "CRM_CONTACT_READ", context(c));
        return new CustomerDetail(view(c), contacts.findAllByCustomerIdOrderByCreatedAtAsc(id).stream()
            .map(x -> new ContactView(x.id, x.version, x.name, x.position, canReadContacts ? x.phone : null,
                canReadContacts ? x.email : null, x.status, canReadContacts)).toList(),
            opportunities.findAllByCustomerIdOrderByUpdatedAtDesc(id).stream()
                .filter(o -> access.allows(actor, "CRM_OPPORTUNITY_READ", context(o))).map(this::view).toList(),
            history.list(id), "MERGED".equals(c.status) ? List.of() : access.actions(actor, context(c),
                "CRM_CUSTOMER_EDIT", "CRM_CUSTOMER_MERGE", "CRM_CONTACT_EDIT"));
    }

    @Transactional
    public CustomerDetail createCustomer(SessionPrincipal actor, CustomerInput input) {
        var owner = access.account(input.ownerAccountId());
        access.require(actor, "CRM_CUSTOMER_CREATE", access.owned(owner.accountId(), owner.organizationUnitId(), null));
        var reservation = access.reserve(actor, "crm.customer", input.requestId(), input);
        if (reservation.replayed()) return customer(actor, reservation.targetId());
        var c = new Customer(); c.code = code("CUS", c.id);
        fill(c, input); customers.saveAndFlush(c);
        history.record(c.id, "CUSTOMER", "CUSTOMER_CREATED", "建立客户主档。", actor.accountId());
        access.complete(reservation, c.id);
        return customer(actor, c.id);
    }

    @Transactional
    public CustomerDetail updateCustomer(SessionPrincipal actor, UUID id, CustomerInput input) {
        var c = lockCustomer(actor, id); access.require(actor, "CRM_CUSTOMER_EDIT", context(c));
        var reservation = access.reserve(actor, "crm.customer.edit:" + id, input.requestId(), input);
        if (reservation.replayed()) return customer(actor, id);
        version(c, input.version()); if ("MERGED".equals(c.status)) throw conflict("已合并来源只读，请打开保留主档。");
        var owner = access.account(input.ownerAccountId());
        access.require(actor, "CRM_CUSTOMER_EDIT", access.owned(owner.accountId(), owner.organizationUnitId(), id));
        fill(c, input); c.touch(); customers.saveAndFlush(c);
        history.record(id, "CUSTOMER", "CUSTOMER_UPDATED", "更新客户资料与维护责任。", actor.accountId());
        access.complete(reservation, id); return customer(actor, id);
    }

    @Transactional
    public CustomerDetail saveContact(SessionPrincipal actor, UUID customerId, UUID contactId, ContactInput input) {
        var c = lockCustomer(actor, customerId); access.require(actor, "CRM_CONTACT_EDIT", context(c));
        access.require(actor, "CRM_CONTACT_READ", context(c));
        if ("MERGED".equals(c.status)) throw conflict("请在合并后的保留主档维护联系人。");
        var reservation = access.reserve(actor, "crm.contact:" + customerId, input.requestId(), List.of(String.valueOf(contactId), input));
        if (reservation.replayed()) return customer(actor, customerId);
        var contact = contactId == null ? new Contact() : contacts.findById(contactId).orElseThrow(BusinessRules::missing);
        if (contactId != null) {
            if (!customerId.equals(contact.customerId)) throw missing();
            version(contact, input.version());
        }
        contact.customerId = customerId; contact.name = required(input.name(), "name", 120);
        contact.position = optional(input.position(), "position", 120);
        contact.phone = optional(input.phone(), "phone", 40); contact.email = optional(input.email(), "email", 160);
        if (contact.phone == null && contact.email == null) throw invalid("phone", "手机或邮箱至少填写一项。");
        if (contact.phone != null && !contact.phone.matches("[+()0-9 .-]{5,40}")) throw invalid("phone", "请输入有效联系电话。");
        contact.status = choice(input.status(), "status", "ACTIVE", "INACTIVE"); contact.touch();
        contacts.saveAndFlush(contact); c.touch(); customers.flush();
        history.record(customerId, "CUSTOMER", "CONTACT_SAVED", "维护联系人资料（联系方式不写入事件摘要）。", actor.accountId());
        access.complete(reservation, customerId); return customer(actor, customerId);
    }

    public MergePreview mergePreview(SessionPrincipal actor, UUID targetId, UUID sourceId) {
        if (targetId.equals(sourceId)) throw invalid("sourceId", "来源客户不能与保留客户相同。");
        var target = customerRecord(actor, targetId); var source = customerRecord(actor, sourceId);
        checkMergeAccess(actor, target, source);
        List<String> differences = new ArrayList<>();
        if (!Objects.equals(target.name, source.name)) differences.add("客户名称");
        if (!Objects.equals(target.identifier, source.identifier)) differences.add("统一识别码");
        if (!Objects.equals(target.industry, source.industry)) differences.add("行业");
        if (!Objects.equals(target.region, source.region)) differences.add("地区");
        return new MergePreview(view(target), view(source), contacts.findAllByCustomerIdOrderByCreatedAtAsc(sourceId).size(),
            opportunities.findAllByCustomerIdOrderByUpdatedAtDesc(sourceId).size(), differences);
    }

    @Transactional
    public CustomerDetail merge(SessionPrincipal actor, UUID targetId, MergeInput input) {
        if (targetId.equals(input.sourceId())) throw invalid("sourceId", "请选择不同的来源客户。");
        var ids = new ArrayList<>(List.of(targetId, input.sourceId())); ids.sort(UUID::compareTo);
        ids.forEach(id -> customers.lockById(id).orElseThrow(BusinessRules::missing));
        var target = customerRecord(actor, targetId); var source = customerRecord(actor, input.sourceId());
        access.require(actor, "CRM_CUSTOMER_MERGE", context(target));
        var reservation = access.reserve(actor, "crm.merge:" + targetId, input.requestId(), input);
        if (reservation.replayed()) return customer(actor, targetId);
        checkMergeAccess(actor, target, source); version(target, input.version()); version(source, input.sourceVersion());
        String policy = choice(input.fieldPolicy(), "fieldPolicy", "KEEP_TARGET", "USE_SOURCE");
        String reason = required(input.reason(), "reason", 1000);
        var moved = opportunities.findAllByCustomerIdOrderByUpdatedAtDesc(source.id);
        for (var o : moved) {
            if (o.eventKey != null && opportunities.findByCustomerIdAndEventKey(targetId, o.eventKey).isPresent())
                throw conflict("两个客户存在相同采购事件，请先核对商机关系后合并。");
        }
        source.activeIdentifier = null; customers.saveAndFlush(source);
        if ("USE_SOURCE".equals(policy)) {
            target.name = source.name; target.normalizedName = source.normalizedName; target.shortName = source.shortName;
            target.identifier = source.identifier; target.activeIdentifier = normalizedIdentifier(source.identifier);
            target.industry = source.industry; target.region = source.region; target.source = source.source;
        }
        contacts.findAllByCustomerIdOrderByCreatedAtAsc(source.id).forEach(c -> { c.customerId = targetId; c.touch(); });
        moved.forEach(o -> { o.customerId = targetId; o.touch(); });
        source.status = "MERGED"; source.mergedIntoId = targetId; source.touch(); target.touch();
        customers.flush(); opportunities.flush(); contacts.flush();
        history.record(targetId, "CUSTOMER", "CUSTOMER_MERGED", "并入来源 " + source.code + "；字段策略 " + policy + "；联系人全部保留。" + reason, actor.accountId());
        history.record(source.id, "CUSTOMER", "CUSTOMER_MERGED_INTO", "已合并至 " + target.code + "。" + reason, actor.accountId());
        access.complete(reservation, targetId); return customer(actor, targetId);
    }

    public PageResponse<OpportunityView> opportunities(SessionPrincipal actor, String q, String status, UUID customerId,
            String grade, String health, int page, int size) {
        var visible = opportunities.findAll(Sort.by(Sort.Direction.DESC, "updatedAt")).stream()
            .filter(o -> access.allows(actor, "CRM_OPPORTUNITY_READ", context(o)))
            .filter(o -> customerId == null || customerId.equals(o.customerId))
            .filter(o -> status == null || status.isBlank() || status.equals(o.status))
            .filter(o -> grade == null || grade.isBlank() || grade.equals(o.grade))
            .filter(o -> matches(q, o.title, o.code, o.eventKey, customerName(o.customerId)))
            .map(this::view).filter(o -> health == null || health.isBlank() || health.equals(o.health())).toList();
        return page(visible, page, size);
    }

    public OpportunityDetail opportunity(SessionPrincipal actor, UUID id) {
        var o = opportunityRecord(actor, id);
        var allowed = "CLOSED".equals(o.status)
            ? access.actions(actor, context(o), "CRM_OPPORTUNITY_RESULT")
            : access.actions(actor, context(o), "CRM_OPPORTUNITY_EDIT", "CRM_OPPORTUNITY_RESULT", "PROJECT_CREATE");
        return new OpportunityDetail(view(o), activities.findAllByOpportunityIdOrderByCreatedAtDesc(id).stream()
            .map(a -> new ActivityView(a.id, a.fact, a.nextAction, a.assigneeId, access.name(a.assigneeId),
                a.dueDate, access.name(a.recordedBy), a.createdAt)).toList(), history.list(id), allowed);
    }

    @Transactional
    public OpportunityDetail createOpportunity(SessionPrincipal actor, OpportunityInput input) {
        var owner = access.account(input.ownerAccountId());
        access.require(actor, "CRM_OPPORTUNITY_CREATE", access.owned(owner.accountId(), owner.organizationUnitId(), null));
        var reservation = access.reserve(actor, "crm.opportunity", input.requestId(), input);
        if (reservation.replayed()) return opportunity(actor, reservation.targetId());
        var c = lockCustomer(actor, input.customerId());
        if (!"ACTIVE".equals(c.status)) throw invalid("customerId", "请选择启用的客户主档。");
        var o = new Opportunity(); o.code = code("OPP", o.id); o.grade = "D"; o.progress = "LEAD";
        o.status = "ACTIVE"; o.result = "PENDING"; fill(o, input);
        opportunities.saveAndFlush(o);
        history.record(o.id, "OPPORTUNITY", "OPPORTUNITY_CREATED", "登记商机，等级 D / 初步接洽；行动可继续补齐。", actor.accountId());
        access.complete(reservation, o.id); return opportunity(actor, o.id);
    }

    @Transactional
    public OpportunityDetail updateOpportunity(SessionPrincipal actor, UUID id, OpportunityInput input) {
        var o = lockOpportunity(actor, id); access.require(actor, "CRM_OPPORTUNITY_EDIT", context(o));
        var reservation = access.reserve(actor, "crm.opportunity.edit:" + id, input.requestId(), input);
        if (reservation.replayed()) return opportunity(actor, id);
        writable(o); version(o, input.version());
        if (!o.customerId.equals(input.customerId()) || !o.ownerAccountId.equals(input.ownerAccountId()))
            throw invalid("customerId", "商机创建后，客户与责任商务须通过主档合并或责任交接流程调整。");
        fill(o, input); o.touch(); opportunities.saveAndFlush(o);
        history.record(id, "OPPORTUNITY", "OPPORTUNITY_UPDATED", "更新商机背景与渐进资料。", actor.accountId());
        access.complete(reservation, id); return opportunity(actor, id);
    }

    @Transactional
    public OpportunityDetail classify(SessionPrincipal actor, UUID id, ClassificationInput input) {
        var o = lockOpportunity(actor, id); access.require(actor, "CRM_OPPORTUNITY_EDIT", context(o));
        var reservation = access.reserve(actor, "crm.classify:" + id, input.requestId(), input);
        if (reservation.replayed()) return opportunity(actor, id);
        writable(o); version(o, input.version());
        if ((input.grade() == null) == (input.progress() == null)) throw invalid("grade", "每次单独变更等级或销售进展。");
        String reason = required(input.reason(), "reason", 1000);
        if (input.grade() != null) {
            String previous = o.grade; o.grade = choice(input.grade(), "grade", "A", "B", "C", "D");
            history.record(id, "OPPORTUNITY", "GRADE_CHANGED", previous + " → " + o.grade + "；" + reason, actor.accountId());
        } else {
            String previous = o.progress; o.progress = choice(input.progress(), "progress", "LEAD", "QUALIFIED", "SOLUTION", "QUOTATION", "NEGOTIATION");
            history.record(id, "OPPORTUNITY", "PROGRESS_CHANGED", previous + " → " + o.progress + "；" + reason, actor.accountId());
        }
        o.touch(); opportunities.flush(); access.complete(reservation, id); return opportunity(actor, id);
    }

    @Transactional
    public OpportunityDetail recordActivity(SessionPrincipal actor, UUID id, ActivityInput input) {
        var o = lockOpportunity(actor, id); access.require(actor, "CRM_OPPORTUNITY_EDIT", context(o));
        var reservation = access.reserve(actor, "crm.activity:" + id, input.requestId(), input);
        if (reservation.replayed()) return opportunity(actor, id);
        writable(o); version(o, input.version());
        var a = new OpportunityActivity(); a.opportunityId = id; a.fact = required(input.fact(), "fact", 4000);
        a.nextAction = optional(input.nextAction(), "nextAction", 1000); a.assigneeId = input.assigneeId(); a.dueDate = input.dueDate();
        if ((a.nextAction != null || a.assigneeId != null || a.dueDate != null)
                && (a.nextAction == null || a.assigneeId == null || a.dueDate == null)) throw invalid("nextAction", "下一步行动、责任人和计划日期需一并填写。");
        if (a.assigneeId != null) access.account(a.assigneeId);
        a.recordedBy = actor.accountId(); activities.save(a); o.touch(); opportunities.flush();
        history.record(id, "OPPORTUNITY", "ACTIVITY_RECORDED", "新增业务事实与下一步行动。", actor.accountId());
        access.complete(reservation, id); return opportunity(actor, id);
    }

    @Transactional
    public OpportunityDetail result(SessionPrincipal actor, UUID id, ResultInput input) {
        var o = lockOpportunity(actor, id); access.require(actor, "CRM_OPPORTUNITY_RESULT", context(o));
        var reservation = access.reserve(actor, "crm.result:" + id, input.requestId(), input);
        if (reservation.replayed()) return opportunity(actor, id);
        writable(o); version(o, input.version());
        String result = choice(input.result(), "result", "SUCCESS", "FAILURE", "CUSTOMER_CANCELLED", "TERMINATED");
        String status = choice(input.status(), "status", "ACTIVE", "CLOSED");
        if (("SUCCESS".equals(result) && !"ACTIVE".equals(status)) || (!"SUCCESS".equals(result) && !"CLOSED".equals(status)))
            throw invalid("status", "成功后保留进行中以接续合同；失败、取消或终止必须显式选择关闭。");
        String category = choice(input.reasonCategory(), "reasonCategory", "PRICE", "TECHNICAL", "TIMING", "CUSTOMER", "OTHER");
        String reason = required(input.reason(), "reason", 1000); String evidence = required(input.evidence(), "evidence", 2000);
        String previous = o.result; String previousStatus = o.status; o.result = result; o.status = status; o.touch();
        publisher.publishEvent(new OpportunityResultChanged(id, o.projectId, status, result, actor.accountId()));
        opportunities.flush();
        history.record(id, "OPPORTUNITY", "BUSINESS_RESULT_CHANGED", previous + " → " + result + "；" + category + "；" + reason + "；依据：" + evidence, actor.accountId());
        history.record(id, "OPPORTUNITY", "OPPORTUNITY_STATUS_CHANGED", previousStatus + " → " + status, actor.accountId());
        access.complete(reservation, id); return opportunity(actor, id);
    }

    @Transactional
    public OpportunityDetail reopen(SessionPrincipal actor, UUID id, ReopenInput input) {
        var o = lockOpportunity(actor, id); access.require(actor, "CRM_OPPORTUNITY_RESULT", context(o));
        var reservation = access.reserve(actor, "crm.reopen:" + id, input.requestId(), input);
        if (reservation.replayed()) return opportunity(actor, id);
        version(o, input.version()); if (!"CLOSED".equals(o.status)) throw conflict("只有已关闭的同一采购事件可以重开。");
        String reason = required(input.reason(), "reason", 1000); o.status = "ACTIVE"; o.result = "PENDING"; o.touch();
        publisher.publishEvent(new OpportunityResultChanged(id, o.projectId, o.status, o.result, actor.accountId()));
        opportunities.flush(); history.record(id, "OPPORTUNITY", "OPPORTUNITY_REOPENED", "同一采购事件重开；结果恢复待定。" + reason, actor.accountId());
        access.complete(reservation, id); return opportunity(actor, id);
    }

    @Override public OpportunityReference reference(UUID id) {
        return reference(opportunities.findById(id).orElseThrow(BusinessRules::missing));
    }
    @Override public boolean canReadCustomer(SessionPrincipal actor, UUID id) {
        return customers.findById(id).filter(c -> access.allows(actor,"CRM_CUSTOMER_READ",context(c))).isPresent();
    }
    @Override public boolean canReadOpportunity(SessionPrincipal actor, UUID id) {
        return opportunities.findById(id).filter(o -> access.allows(actor,"CRM_OPPORTUNITY_READ",context(o))).isPresent();
    }
    @Override @Transactional public OpportunityReference lockForProject(SessionPrincipal actor, UUID id) {
        var o = lockOpportunity(actor, id); access.require(actor, "PROJECT_CREATE", context(o)); writable(o);
        return reference(o);
    }
    @Override @Transactional public void bindProject(UUID opportunityId, UUID projectId) {
        var o = opportunities.lockById(opportunityId).orElseThrow(BusinessRules::missing);
        if (o.projectId != null && !o.projectId.equals(projectId)) throw conflict("该商机已创建项目空间。");
        o.projectId = projectId; o.touch(); opportunities.flush();
    }

    private void fill(Customer c, CustomerInput i) {
        c.name = required(i.name(), "name", 160); c.normalizedName = normalized(c.name);
        c.shortName = optional(i.shortName(), "shortName", 80); c.kind = choice(i.kind(), "kind", "PROSPECT", "CUSTOMER");
        c.identifier = optional(i.identifier(), "identifier", 80); c.activeIdentifier = normalizedIdentifier(c.identifier);
        if (c.activeIdentifier != null && customers.findByActiveIdentifier(c.activeIdentifier).filter(x -> !x.id.equals(c.id)).isPresent())
            throw invalid("identifier", "此统一识别码已登记，请选择已有客户。");
        c.industry = optional(i.industry(), "industry", 80); c.region = optional(i.region(), "region", 120);
        c.source = required(i.source(), "source", 120); var owner = access.account(i.ownerAccountId());
        c.ownerAccountId = owner.accountId(); c.organizationUnitId = owner.organizationUnitId();
        c.status = choice(i.status(), "status", "ACTIVE", "INACTIVE");
    }
    private void fill(Opportunity o, OpportunityInput i) {
        o.customerId = i.customerId(); o.title = required(i.title(), "title", 160); o.eventKey = optional(i.eventKey(), "eventKey", 120);
        if (o.eventKey != null && opportunities.findByCustomerIdAndEventKey(o.customerId, o.eventKey).filter(x -> !x.id.equals(o.id)).isPresent())
            throw invalid("eventKey", "该客户的采购事件已登记，请打开原商机。");
        if (o.eventKey == null && opportunities.findAllByCustomerIdOrderByUpdatedAtDesc(o.customerId).stream()
            .anyMatch(x -> !x.id.equals(o.id) && normalized(x.title).equals(normalized(o.title))))
            throw invalid("eventKey", "该客户有同名商机；如属于独立采购事件，请填写不同的采购事件编号。");
        var owner = access.account(i.ownerAccountId()); o.ownerAccountId = owner.accountId(); o.organizationUnitId = owner.organizationUnitId();
        o.source = required(i.source(), "source", 120); o.procurementMethod = choice(i.procurementMethod() == null ? "TENDER" : i.procurementMethod(), "procurementMethod", "TENDER", "DIRECT");
        o.estimatedAmount = i.estimatedAmount() == null ? null : amount(i.estimatedAmount(), "estimatedAmount");
        o.targetDate = i.targetDate(); o.background = optional(i.background(), "background", 8000);
    }
    private Customer customerRecord(SessionPrincipal actor, UUID id) {
        var c = customers.findById(id).orElseThrow(BusinessRules::missing); access.readable(actor, "CRM_CUSTOMER_READ", context(c)); return c;
    }
    private Customer lockCustomer(SessionPrincipal actor, UUID id) {
        var c = customers.lockById(id).orElseThrow(BusinessRules::missing); access.readable(actor, "CRM_CUSTOMER_READ", context(c)); return c;
    }
    private Opportunity opportunityRecord(SessionPrincipal actor, UUID id) {
        var o = opportunities.findById(id).orElseThrow(BusinessRules::missing); access.readable(actor, "CRM_OPPORTUNITY_READ", context(o)); return o;
    }
    private Opportunity lockOpportunity(SessionPrincipal actor, UUID id) {
        var o = opportunities.lockById(id).orElseThrow(BusinessRules::missing); access.readable(actor, "CRM_OPPORTUNITY_READ", context(o)); return o;
    }
    private void checkMergeAccess(SessionPrincipal actor, Customer target, Customer source) {
        for (var c : List.of(target, source)) {
            access.require(actor, "CRM_CUSTOMER_MERGE", context(c)); access.require(actor, "CRM_CONTACT_READ", context(c));
            access.require(actor, "CRM_CONTACT_EDIT", context(c));
            if (!"ACTIVE".equals(c.status)) throw conflict("请选择两个启用且尚未合并的客户。");
            opportunities.findAllByCustomerIdOrderByUpdatedAtDesc(c.id)
                .forEach(o -> access.require(actor, "CRM_OPPORTUNITY_EDIT", context(o)));
        }
    }
    private void writable(Opportunity o) { if ("CLOSED".equals(o.status)) throw conflict("商机已关闭，仅可查看或受控重开。"); }
    private ResourceContext context(Customer c) { return access.owned(c.ownerAccountId, c.organizationUnitId, c.id); }
    private ResourceContext context(Opportunity o) { return access.owned(o.ownerAccountId, o.organizationUnitId, o.id); }
    private String customerName(UUID id) { return customers.findById(id).map(c -> c.name).orElse("历史客户"); }
    private String normalizedIdentifier(String id) { return id == null ? null : normalized(id); }
    private static String code(String prefix, UUID id) { return prefix + "-" + id.toString().substring(0, 8).toUpperCase(Locale.ROOT); }
    private CustomerView view(Customer c) {
        return new CustomerView(c.id, c.version, c.code, c.name, c.shortName, c.kind, c.identifier,
            c.industry, c.region, c.source, c.ownerAccountId, access.name(c.ownerAccountId), c.status, c.mergedIntoId, c.updatedAt);
    }
    private OpportunityView view(Opportunity o) {
        var a = activities.findAllByOpportunityIdOrderByCreatedAtDesc(o.id).stream().findFirst().orElse(null);
        String health = "CLOSED".equals(o.status) ? "CLOSED" : a == null || a.nextAction == null ? "MISSING_ACTION"
            : a.dueDate.isBefore(LocalDate.now()) ? "OVERDUE"
            : ChronoUnit.DAYS.between(a.createdAt, java.time.Instant.now()) >= 30 ? "STALE" : "ON_TRACK";
        return new OpportunityView(o.id, o.version, o.code, o.customerId, customerName(o.customerId), o.title, o.eventKey,
            o.ownerAccountId, access.name(o.ownerAccountId), o.source, o.grade, o.progress, o.procurementMethod,
            o.estimatedAmount, o.targetDate, o.background, o.status, o.result, o.projectId, health,
            a == null ? null : a.nextAction, a == null ? null : access.name(a.assigneeId), a == null ? null : a.dueDate, o.updatedAt);
    }
    private OpportunityReference reference(Opportunity o) {
        return new OpportunityReference(o.id, o.customerId, customerName(o.customerId), o.title, o.ownerAccountId,
            o.organizationUnitId, o.background, o.procurementMethod, o.status, o.result, o.projectId);
    }
}
