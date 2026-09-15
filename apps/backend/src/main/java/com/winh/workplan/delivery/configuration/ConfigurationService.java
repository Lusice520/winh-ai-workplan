package com.winh.workplan.delivery.configuration;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.delivery.configuration.ConfigurationCommands.*;
import static com.winh.workplan.delivery.configuration.ConfigurationDefinitions.*;
import static com.winh.workplan.delivery.configuration.ConfigurationViews.*;

import com.winh.workplan.business.*;
import com.winh.workplan.delivery.DeliveryConfigurationDirectory;
import com.winh.workplan.iam.authorization.ResourceContext;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import com.winh.workplan.iam.shared.PageResponse;
import com.winh.workplan.project.ProjectDirectory;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly = true)
public class ConfigurationService implements DeliveryConfigurationDirectory {
    private static final String[] PERMISSIONS = { "DELIVERY_CONFIG_READ", "DELIVERY_TEMPLATE_MANAGE",
        "DELIVERY_POLICY_MANAGE", "DELIVERY_POLICY_PUBLISH" };
    private final ConfigurationSeriesRepository series;
    private final ConfigurationEditionRepository editions;
    private final ConfigurationCodec codec;
    private final BusinessAccess access;
    private final BusinessHistory history;
    private final ProjectDirectory projects;

    ConfigurationService(ConfigurationSeriesRepository series, ConfigurationEditionRepository editions,
            ConfigurationCodec codec, BusinessAccess access, BusinessHistory history, ProjectDirectory projects) {
        this.series = series; this.editions = editions; this.codec = codec;
        this.access = access; this.history = history; this.projects = projects;
    }

    public List<String> capabilities(SessionPrincipal actor) {
        return access.actions(actor, ResourceContext.empty(), PERMISSIONS);
    }
    public PageResponse<Row> list(SessionPrincipal actor, String q, String kind, String status, int page, int pageSize) {
        readPermission(actor);
        if (kind != null && !kind.isBlank()) choice(kind, "kind", "STAGE_TEMPLATE", "REVIEW_POLICY");
        if (status != null && !status.isBlank()) choice(status, "status", "DRAFT", "PUBLISHED", "RETIRED");
        var rows = editions.findAllByOrderByUpdatedAtDesc().stream()
            .filter(e -> kind == null || kind.isBlank() || e.kind.equals(kind))
            .filter(e -> status == null || status.isBlank() || e.status.equals(status))
            .filter(e -> matches(q, e.name, e.versionNote)).map(this::row).toList();
        return page(rows, page, pageSize);
    }
    public Detail detail(SessionPrincipal actor, UUID id) {
        readPermission(actor);
        var e = require(id); var d = codec.read(e.definitionJson);
        var people = new LinkedHashSet<UUID>();
        if (d.policy() != null) {
            d.policy().reviewers().forEach(r -> people.add(r.accountId()));
            if (d.policy().finalApproverId() != null) people.add(d.policy().finalApproverId());
        }
        var allowed = new ArrayList<String>();
        if ("DRAFT".equals(e.status)) {
            if (allows(actor, manage(e.kind))) allowed.add("EDIT");
            if (allows(actor, publish(e.kind))) allowed.add("PUBLISH");
        } else {
            if (allows(actor, manage(e.kind)) && !editions.existsBySeriesIdAndStatus(e.seriesId, "DRAFT")) allowed.add("NEXT_VERSION");
            if ("PUBLISHED".equals(e.status) && allows(actor, publish(e.kind))) allowed.add("RETIRE");
        }
        return new Detail(row(e), e.versionNote, d.template(), d.policy(), e.snapshotHash,
            people.stream().map(p -> new PersonLabel(p, access.name(p))).toList(), publicationProblems(d),
            editions.findAllBySeriesIdOrderByEditionDesc(e.seriesId).stream().map(this::row).toList(),
            e.retirementReason, e.retiredAt, history.list(e.seriesId), List.copyOf(allowed));
    }

    @Transactional public Detail create(SessionPrincipal actor, Create input) {
        String kind = choice(input.kind(), "kind", "STAGE_TEMPLATE", "REVIEW_POLICY");
        requirePermission(actor, manage(kind));
        var res = access.reserve(actor, "delivery.config.create", input.requestId(), input);
        if (res.replayed()) return detail(actor, res.targetId());
        var s = new ConfigurationSeries(); s.kind = kind; s.latestEdition = 1; series.saveAndFlush(s);
        var e = new ConfigurationEdition(); e.seriesId = s.id; e.edition = 1; e.kind = kind; e.createdBy = actor.accountId();
        fill(e, input.name(), input.versionNote(), input.template(), input.policy()); editions.saveAndFlush(e);
        history.record(s.id, "DELIVERY_CONFIGURATION", "DELIVERY_CONFIGURATION_CREATED", "建立配置草稿 v1。", actor.accountId());
        access.complete(res, e.id); return detail(actor, e.id);
    }
    @Transactional public Detail update(SessionPrincipal actor, UUID id, Update input) {
        readPermission(actor); var e = require(id); requirePermission(actor, manage(e.kind)); lock(e);
        var res = access.reserve(actor, "delivery.config.update:" + id, input.requestId(), input);
        if (res.replayed()) return detail(actor, id);
        version(e, input.version());
        if (!"DRAFT".equals(e.status)) throw conflict("已发布或已退役的版本不可修改，请创建下一版草稿。");
        fill(e, input.name(), input.versionNote(), input.template(), input.policy()); e.touch(); editions.flush();
        history.record(e.seriesId, "DELIVERY_CONFIGURATION", "DELIVERY_CONFIGURATION_UPDATED", "维护配置草稿 v" + e.edition + "。", actor.accountId());
        access.complete(res, id); return detail(actor, id);
    }
    @Transactional public Detail nextVersion(SessionPrincipal actor, UUID id, Transition input) {
        readPermission(actor); var previous = require(id); requirePermission(actor, manage(previous.kind)); var s = lock(previous);
        var res = access.reserve(actor, "delivery.config.next:" + id, input.requestId(), input);
        if (res.replayed()) return detail(actor, res.targetId());
        version(previous, input.version());
        if ("DRAFT".equals(previous.status)) throw conflict("请继续维护当前草稿，发布后再创建下一版。");
        if (editions.existsBySeriesIdAndStatus(s.id, "DRAFT")) throw conflict("此配置已有待完善草稿，请打开该版本继续维护。");
        var e = new ConfigurationEdition(); e.seriesId = s.id; e.kind = s.kind; e.edition = ++s.latestEdition;
        e.name = previous.name; e.versionNote = required(input.reason(), "reason", 2000);
        e.definitionJson = previous.definitionJson; e.createdBy = actor.accountId(); s.touch(); editions.saveAndFlush(e); series.flush();
        history.record(s.id, "DELIVERY_CONFIGURATION", "DELIVERY_CONFIGURATION_VERSION_CREATED",
            "从 v" + previous.edition + " 建立 v" + e.edition + " 草稿，已引用的项目保持原快照。", actor.accountId());
        access.complete(res, e.id); return detail(actor, e.id);
    }
    @Transactional public Detail publish(SessionPrincipal actor, UUID id, Transition input) {
        readPermission(actor); var e = require(id); requirePermission(actor, publish(e.kind)); lock(e);
        var res = access.reserve(actor, "delivery.config.publish:" + id, input.requestId(), input);
        if (res.replayed()) return detail(actor, id);
        version(e, input.version()); required(input.reason(), "reason", 2000);
        if (!"DRAFT".equals(e.status)) throw conflict("仅草稿可以发布。");
        var d = codec.read(e.definitionJson); var problems = publicationProblems(d);
        if (!problems.isEmpty()) throw invalid("definition", "发布条件未满足：" + problems.getFirst().message());
        e.snapshotHash = codec.hash(new Publication(e.seriesId, e.edition, e.kind, e.name, e.versionNote, d));
        e.status = "PUBLISHED"; e.publishedBy = actor.accountId(); e.publishedAt = Instant.now(); e.touch(); editions.flush();
        history.record(e.seriesId, "DELIVERY_CONFIGURATION", "DELIVERY_CONFIGURATION_PUBLISHED",
            "发布并锁定 v" + e.edition + "；" + input.reason().trim(), actor.accountId());
        access.complete(res, id); return detail(actor, id);
    }
    @Transactional public Detail retire(SessionPrincipal actor, UUID id, Transition input) {
        readPermission(actor); var e = require(id); requirePermission(actor, publish(e.kind)); lock(e);
        var res = access.reserve(actor, "delivery.config.retire:" + id, input.requestId(), input);
        if (res.replayed()) return detail(actor, id);
        version(e, input.version());
        if (!"PUBLISHED".equals(e.status)) throw conflict("仅已发布版本可以退役。");
        e.retirementReason = required(input.reason(), "reason", 2000); e.status = "RETIRED";
        e.retiredBy = actor.accountId(); e.retiredAt = Instant.now(); e.touch(); editions.flush();
        history.record(e.seriesId, "DELIVERY_CONFIGURATION", "DELIVERY_CONFIGURATION_RETIRED",
            "退役 v" + e.edition + "，停止新引用，已使用项目及旧快照保留；" + e.retirementReason, actor.accountId());
        access.complete(res, id); return detail(actor, id);
    }

    @Override public List<PublishedConfiguration> available(SessionPrincipal actor, UUID projectId, String kind) {
        projects.requireReadable(actor, projectId, "DG2_READ"); choice(kind, "kind", "STAGE_TEMPLATE", "REVIEW_POLICY");
        if ("REVIEW_POLICY".equals(kind)) projects.requireReadable(actor, projectId, "DELIVERY_BUDGET_READ");
        return editions.findAllByKindAndStatusOrderByUpdatedAtDesc(kind, "PUBLISHED").stream().map(this::published).toList();
    }
    @Override @Transactional(readOnly = true, noRollbackFor = DomainException.class)
    public PublishedConfiguration requireSelectable(SessionPrincipal actor, UUID projectId, UUID id, String kind) {
        projects.requireReadable(actor, projectId, "DG2_READ");
        if ("REVIEW_POLICY".equals(kind)) projects.requireReadable(actor, projectId, "DELIVERY_BUDGET_READ");
        var e = require(id);
        if (!e.kind.equals(kind) || !"PUBLISHED".equals(e.status)) throw conflict("请选择仍可引用的已发布配置版本。");
        return published(e);
    }

    private void fill(ConfigurationEdition e, String name, String note, Template template, Policy policy) {
        e.name = required(name, "name", 160); e.versionNote = required(note, "versionNote", 2000);
        e.definitionJson = codec.write(ConfigurationRules.normalize(e.kind, template, policy));
    }
    private List<Problem> publicationProblems(Definition d) {
        var problems = new ArrayList<>(ConfigurationRules.problems(d));
        if (d.policy() != null) {
            var ids = new LinkedHashSet<UUID>(); d.policy().reviewers().forEach(r -> ids.add(r.accountId()));
            if (d.policy().finalApproverId() != null) ids.add(d.policy().finalApproverId());
            for (UUID id : ids) {
                try { access.account(id); }
                catch (DomainException e) { problems.add(new Problem("reviewers", "配置中的评审人已停用或不存在，请重新选择。")); }
            }
        }
        return List.copyOf(problems);
    }
    private Row row(ConfigurationEdition e) {
        var d = codec.read(e.definitionJson);
        return new Row(e.id, e.version, e.seriesId, e.edition, e.kind, e.name, e.status,
            d.template() != null ? d.template().projectTypes() : d.policy().projectTypes(),
            d.template() == null ? 0 : d.template().stages().size(), d.policy() == null ? 0 : d.policy().reviewers().size(),
            access.name(e.createdBy), access.name(e.publishedBy), e.publishedAt, e.updatedAt);
    }
    private PublishedConfiguration published(ConfigurationEdition e) {
        var d = codec.read(e.definitionJson);
        return new PublishedConfiguration(e.id, e.seriesId, e.edition, e.name, e.kind, d.template(), d.policy(), e.snapshotHash);
    }
    private ConfigurationEdition require(UUID id) { return editions.findById(id).orElseThrow(BusinessRules::missing); }
    private ConfigurationSeries lock(ConfigurationEdition e) { return series.lock(e.seriesId).orElseThrow(BusinessRules::missing); }
    private void readPermission(SessionPrincipal actor) { requirePermission(actor, "DELIVERY_CONFIG_READ"); }
    private void requirePermission(SessionPrincipal actor, String permission) { access.require(actor, permission, ResourceContext.empty()); }
    private boolean allows(SessionPrincipal actor, String permission) { return access.allows(actor, permission, ResourceContext.empty()); }
    private static String manage(String kind) { return "STAGE_TEMPLATE".equals(kind) ? "DELIVERY_TEMPLATE_MANAGE" : "DELIVERY_POLICY_MANAGE"; }
    private static String publish(String kind) { return "STAGE_TEMPLATE".equals(kind) ? "DELIVERY_TEMPLATE_MANAGE" : "DELIVERY_POLICY_PUBLISH"; }
    private record Publication(UUID seriesId, int edition, String kind, String name, String versionNote, Definition definition) {}
}
