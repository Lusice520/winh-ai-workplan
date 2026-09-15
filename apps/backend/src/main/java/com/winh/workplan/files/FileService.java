package com.winh.workplan.files;

import static com.winh.workplan.business.BusinessRules.*;
import static com.winh.workplan.files.FileViews.*;
import com.winh.workplan.business.*;
import com.winh.workplan.iam.audit.*;
import com.winh.workplan.iam.authorization.ResourceContext;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.CorrelationIdHolder;
import com.winh.workplan.project.ProjectDirectory;
import java.io.IOException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service @Transactional(readOnly = true)
public class FileService implements FileDirectory {
    private final ProjectDocumentRepository documents;
    private final DocumentVersionRepository versions;
    private final ProjectDirectory projects;
    private final BusinessAccess access;
    private final BusinessHistory history;
    private final AuditRecorder audit;
    private final ObjectStorage storage;
    private final long maxBytes;
    FileService(ProjectDocumentRepository documents, DocumentVersionRepository versions, ProjectDirectory projects,
            BusinessAccess access, BusinessHistory history, AuditRecorder audit, ObjectStorage storage,
            @Value("${app.files.max-bytes:20971520}") long maxBytes) {
        this.documents = documents; this.versions = versions; this.projects = projects; this.access = access;
        this.history = history; this.audit = audit; this.storage = storage; this.maxBytes = maxBytes;
    }
    public Workspace list(SessionPrincipal actor, UUID projectId, String q, String kind, String status, String classification) {
        var ctx = projects.requireReadable(actor, projectId, "FILE_READ");
        var rows = documents.findAllByProjectIdOrderByUpdatedAtDesc(projectId).stream()
            .filter(d -> canSee(actor, ctx.authorization(), d.classification))
            .filter(d -> matches(q, d.title)).filter(d -> blank(kind) || kind.equals(d.kind))
            .filter(d -> blank(classification) || classification.equals(d.classification)).map(this::view)
            .filter(d -> blank(status) || status.equals(d.latestVersion().status())).toList();
        return new Workspace(rows, storage.configured(), maxBytes, allowed(actor, ctx));
    }
    @Transactional
    public Detail detail(SessionPrincipal actor, UUID id) {
        var d = document(id); var ctx = readable(actor, d);
        auditRead(actor, id, "FILE_VIEWED");
        return new Detail(view(d), versions.findAllByDocumentIdOrderByVersionNumberDesc(id).stream().map(this::view).toList(),
            history.list(id), allowed(actor, ctx));
    }
    @Transactional
    public Detail upload(SessionPrincipal actor, UUID projectId, UUID documentId, FileUploadInput input, MultipartFile file) {
        var ctx = projects.requireWritable(actor, projectId, "FILE_UPLOAD");
        access.require(actor, "FILE_READ", ctx.authorization());
        ProjectDocument d = documentId == null ? new ProjectDocument() : document(documentId);
        if (documentId != null && !d.projectId.equals(projectId)) throw missing();
        String classification = documentId == null ? choice(input.classification(), "classification", "INTERNAL", "CONTRACT", "COST") : d.classification;
        if (!canSee(actor, ctx.authorization(), classification)) throw missing();
        if (documentId != null && input.classification() != null && !classification.equals(input.classification()))
            throw invalid("classification", "修订不能改变资料密级，请沿用原资料密级。");
        if (file == null || file.isEmpty() || file.getSize() > maxBytes)
            throw invalid("file", "请选择非空文件，大小不能超过 " + (maxBytes / 1048576) + " MiB。");
        String filename = required(file.getOriginalFilename(), "file", 240);
        if (filename.contains("/") || filename.contains("\\") || filename.chars().anyMatch(Character::isISOControl) || filename.equals(".") || filename.equals(".."))
            throw invalid("file", "文件名包含不支持的路径或控制字符。");
        byte[] content;
        try { content = file.getBytes(); } catch (IOException e) { throw invalid("file", "无法读取此文件，请重新选择。"); }
        String hash = digest(content);
        var reservation = access.reserve(actor, (documentId == null ? "file.upload:" + projectId + ":null" : "file.revise:" + documentId), input.requestId(),
            new UploadFingerprint(input, filename, hash, content.length));
        if (reservation.replayed()) return detail(actor, reservation.targetId());
        if (documentId != null) {
            version(d, input.version());
            if (versions.findAllByDocumentIdOrderByVersionNumberDesc(d.id).stream().anyMatch(v -> "IN_REVIEW".equals(v.status)))
                throw conflict("已有待评审版本，请先完成评审或退回，再上传修订。");
        } else {
            d.projectId = projectId; d.title = required(input.title(), "title", 160);
            d.kind = choice(input.kind(), "kind", "CONTRACT", "SURVEY", "REQUIREMENTS", "SOLUTION", "ESTIMATE", "QUOTATION", "BIDDING", "HANDOVER", "OTHER");
            if ("CONTRACT".equals(d.kind) && !"CONTRACT".equals(classification)) throw invalid("classification", "合同资料必须使用合同敏感密级。");
            if ("ESTIMATE".equals(d.kind) && !"COST".equals(classification)) throw invalid("classification", "成本估算资料必须使用成本敏感密级。");
            d.mainStage = ctx.mainStage(); d.classification = classification; d.createdBy = actor.accountId();
        }
        var previous = documentId == null ? List.<DocumentVersion>of() : versions.findAllByDocumentIdOrderByVersionNumberDesc(d.id);
        var v = new DocumentVersion(); v.documentId = d.id; v.versionNumber = previous.size() + 1;
        v.filename = filename; v.objectKey = "projects/" + projectId + "/" + d.id + "/" + v.id;
        v.sizeBytes = content.length; v.sha256 = hash; v.changeNote = required(input.changeNote(), "changeNote", 2000);
        v.uploadedBy = actor.accountId(); storage.put(v.objectKey, content, hash);
        d.touch(); documents.saveAndFlush(d); versions.saveAndFlush(v);
        history.record(d.id, "FILE", "FILE_UPLOADED", "上传资料 v" + v.versionNumber + "；" + v.changeNote, actor.accountId());
        access.complete(reservation, d.id); return detail(actor, d.id);
    }
    @Transactional
    public Detail transition(SessionPrincipal actor, UUID id, UUID versionId, FileTransitionInput input) {
        var d = document(id); readable(actor, d);
        String decision = choice(input.decision(), "decision", "IN_REVIEW", "PUBLISHED", "RETURNED", "VOID");
        projects.requireWritable(actor, d.projectId, Set.of("PUBLISHED", "RETURNED", "VOID").contains(decision) ? "FILE_PUBLISH" : "FILE_UPLOAD");
        var reservation = access.reserve(actor, "file.transition:" + versionId, input.requestId(), input);
        if (reservation.replayed()) return detail(actor, id);
        var v = storedVersion(id, versionId); version(v, input.version());
        String comment = required(input.comment(), "comment", 2000);
        if ("IN_REVIEW".equals(decision)) {
            if (!Set.of("DRAFT", "RETURNED").contains(v.status)) throw conflict("仅草稿或退回版本可提交评审。");
            var latest = versions.findAllByDocumentIdOrderByVersionNumberDesc(id).getFirst();
            if (!latest.id.equals(v.id)) throw conflict("请提交最新上传的版本。");
        } else if (Set.of("PUBLISHED", "RETURNED").contains(decision)) {
            if (!"IN_REVIEW".equals(v.status)) throw conflict("此版本不在待评审状态。");
            if (v.uploadedBy.equals(actor.accountId())) throw conflict("上传人不能发布或退回自己的版本，请另一名授权人员复核。");
            if (!projects.participant(d.projectId, actor.accountId())) throw conflict("资料评审人须为当前项目有效成员。");
            v.reviewedBy = actor.accountId(); v.reviewedAt = Instant.now();
            if ("PUBLISHED".equals(decision)) {
                if (d.currentVersionId != null) { var old = storedVersion(id, d.currentVersionId); old.status = "SUPERSEDED"; old.touch(); versions.flush(); }
                d.currentVersionId = v.id;
            }
        } else {
            if (Set.of("VOID", "SUPERSEDED").contains(v.status)) throw conflict("此版本已失效。");
            if (v.id.equals(d.currentVersionId)) d.currentVersionId = null;
        }
        v.status = decision; v.reviewComment = comment; v.touch(); d.touch(); versions.flush(); documents.flush();
        history.record(id, "FILE", "FILE_" + decision, "资料 v" + v.versionNumber + "：" + decision + "；" + comment, actor.accountId());
        access.complete(reservation, id); return detail(actor, id);
    }
    @Transactional
    public Download download(SessionPrincipal actor, UUID id, UUID versionId) {
        var d = document(id); var ctx = readable(actor, d); access.require(actor, "FILE_DOWNLOAD", ctx.authorization());
        var v = storedVersion(id, versionId);
        byte[] bytes = storage.get(v.objectKey, v.sizeBytes);
        if (!digest(bytes).equals(v.sha256)) throw conflict("文件校验不一致，已停止下载，请联系资料管理员核查。");
        auditRead(actor, versionId, "FILE_DOWNLOADED"); return new Download(v.filename, bytes);
    }
    @Override @Transactional(readOnly=true,noRollbackFor=com.winh.workplan.iam.shared.DomainException.class)
    public VersionReference reference(SessionPrincipal actor, UUID projectId, UUID versionId) {
        if (versionId == null) throw invalid("fileVersionId", "请选择文件版本。");
        var v = versions.findById(versionId).orElseThrow(BusinessRules::missing); var d = document(v.documentId);
        if (!projectId.equals(d.projectId)) throw invalid("fileVersionId", "文件不属于当前项目。");
        readable(actor, d);
        return new VersionReference(d.id, v.id, d.projectId, d.title, v.filename, v.versionNumber,
            d.classification, v.status, v.id.equals(d.currentVersionId), v.version, v.sha256);
    }
    @Override @Transactional(readOnly=true,noRollbackFor=com.winh.workplan.iam.shared.DomainException.class)
    public VersionReference requirePublished(SessionPrincipal actor, UUID projectId, UUID versionId, String classification) {
        var ref = reference(actor, projectId, versionId);
        if (classification != null && !classification.equals(ref.classification())) throw invalid("fileVersionId", "所选资料密级不符合此业务依据要求。");
        if (!ref.current() || !"PUBLISHED".equals(ref.status())) throw conflict("所选文件不是当前已发布版本，请完成资料评审后再关联。");
        return ref;
    }
    private ProjectDirectory.ProjectContext readable(SessionPrincipal actor, ProjectDocument d) {
        var ctx = projects.requireReadable(actor, d.projectId, "FILE_READ");
        if (!canSee(actor, ctx.authorization(), d.classification)) throw missing(); return ctx;
    }
    private boolean canSee(SessionPrincipal actor, ResourceContext ctx, String classification) {
        return "INTERNAL".equals(classification) || access.allows(actor, "FILE_" + classification + "_READ", ctx);
    }
    private List<String> allowed(SessionPrincipal actor, ProjectDirectory.ProjectContext ctx) {
        var actions = access.actions(actor, ctx.authorization(), "FILE_UPLOAD", "FILE_PUBLISH", "FILE_DOWNLOAD", "FILE_CONTRACT_READ", "FILE_COST_READ");
        return "CLOSED".equals(ctx.status()) ? actions.stream().filter(p -> !Set.of("FILE_UPLOAD", "FILE_PUBLISH").contains(p)).toList() : actions;
    }
    private ProjectDocument document(UUID id) { return documents.findById(id).orElseThrow(BusinessRules::missing); }
    private DocumentVersion storedVersion(UUID id, UUID versionId) {
        return versions.findById(versionId).filter(v -> v.documentId.equals(id)).orElseThrow(BusinessRules::missing);
    }
    private DocumentView view(ProjectDocument d) {
        var latest = versions.findAllByDocumentIdOrderByVersionNumberDesc(d.id).getFirst();
        return new DocumentView(d.id, d.version, d.projectId, d.title, d.kind, d.mainStage, d.classification,
            d.currentVersionId, view(latest), d.updatedAt);
    }
    private VersionView view(DocumentVersion v) { return new VersionView(v.id, v.version, v.versionNumber, v.filename,
        v.sizeBytes, v.sha256, v.status, v.changeNote, v.uploadedBy, access.name(v.uploadedBy), access.name(v.reviewedBy), v.createdAt, v.reviewedAt, v.reviewComment); }
    private void auditRead(SessionPrincipal actor, UUID id, String action) {
        audit.record(new AuditEventCommand(action, actor.accountId(), "FILE", id, AuditOutcome.SUCCEEDED,
            CorrelationIdHolder.currentOrCreate(), "受控访问项目资料。", null, null));
    }
    private static String digest(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private static boolean blank(String value) { return value == null || value.isBlank(); }
    private record UploadFingerprint(FileUploadInput input, String filename, String hash, int size) {}
}
