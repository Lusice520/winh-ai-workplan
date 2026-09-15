package com.winh.workplan.project;
import static com.winh.workplan.project.ProjectCommands.*;
import static com.winh.workplan.project.ProjectViews.*;
import java.util.UUID;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.PageResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/projects")
class ProjectController {
    private final ProjectService projects;
    ProjectController(ProjectService projects) { this.projects = projects; }
    @GetMapping PageResponse<ProjectView> list(@AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(required=false) String q, @RequestParam(required=false) String status,
        @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="10") int pageSize) { return projects.list(actor,q,status,page,pageSize); }
    @GetMapping("/{id}") ProjectDetail detail(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id) { return projects.detail(actor,id); }
    @PostMapping ProjectDetail create(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody CreateProject input) { return projects.create(actor,input); }
    @PatchMapping("/{id}") ProjectDetail edit(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @Valid @RequestBody EditProject input) { return projects.edit(actor,id,input); }
    @PostMapping("/{id}/members") ProjectDetail member(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @Valid @RequestBody SaveMember input) { return projects.saveMember(actor,id,input); }
}
