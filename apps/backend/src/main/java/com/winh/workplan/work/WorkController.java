package com.winh.workplan.work;
import java.util.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/work-items")
class WorkController {
    private final WorkService service;
    WorkController(WorkService service){this.service=service;}
    @GetMapping List<WorkDirectory.WorkReference> list(@AuthenticationPrincipal SessionPrincipal actor,@RequestParam UUID projectId,@RequestParam(required=false) String kind){return service.list(actor,projectId,kind);}
    @GetMapping("/{id}") WorkService.WorkView detail(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id){return service.detail(actor,id);}
    @PostMapping("/{id}/transition") WorkService.WorkView transition(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@Valid @RequestBody WorkService.Transition input){return service.transition(actor,id,input);}
}
