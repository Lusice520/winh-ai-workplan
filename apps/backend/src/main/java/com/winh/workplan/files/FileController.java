package com.winh.workplan.files;
import static com.winh.workplan.files.FileViews.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api")
class FileController {
    private final FileService service;
    FileController(FileService service) { this.service = service; }
    @GetMapping("/projects/{projectId}/files") Workspace list(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID projectId,
        @RequestParam(required = false) String q, @RequestParam(required = false) String kind,
        @RequestParam(required = false) String status, @RequestParam(required = false) String classification) {
        return service.list(actor, projectId, q, kind, status, classification);
    }
    @PostMapping(value = "/projects/{projectId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    Detail upload(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID projectId,
        @RequestPart FileUploadInput metadata, @RequestPart MultipartFile file) { return service.upload(actor, projectId, null, metadata, file); }
    @GetMapping("/files/{id}") Detail detail(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id) { return service.detail(actor, id); }
    @PostMapping(value = "/files/{id}/versions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    Detail revise(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id,
        @RequestPart FileUploadInput metadata, @RequestPart MultipartFile file) {
        var detail = service.detail(actor, id); return service.upload(actor, detail.document().projectId(), id, metadata, file);
    }
    @PostMapping("/files/{id}/versions/{versionId}/transition") Detail transition(@AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable UUID id, @PathVariable UUID versionId, @RequestBody FileTransitionInput input) { return service.transition(actor, id, versionId, input); }
    @GetMapping("/files/{id}/versions/{versionId}/download") ResponseEntity<byte[]> download(@AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable UUID id, @PathVariable UUID versionId) {
        var result = service.download(actor, id, versionId);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).cacheControl(CacheControl.noStore())
            .header("X-Content-Type-Options", "nosniff").header(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(result.filename(), StandardCharsets.UTF_8).build().toString())
            .body(result.content());
    }
}
