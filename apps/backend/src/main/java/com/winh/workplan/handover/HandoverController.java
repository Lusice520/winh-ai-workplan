package com.winh.workplan.handover;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/projects/{projectId}/handover")
class HandoverController {
    private final HandoverService service;
    HandoverController(HandoverService service){this.service=service;}
    @GetMapping HandoverViews.Workspace get(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId){return service.workspace(a,projectId);}
    @PostMapping HandoverViews.Workspace initialize(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody HandoverCommands.Initialize i){return service.initialize(a,projectId,i);}
    @PatchMapping HandoverViews.Workspace configure(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody HandoverCommands.Configure i){return service.configure(a,projectId,i);}
    @PatchMapping("/items/{id}") HandoverViews.Workspace item(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody HandoverCommands.ItemInput i){return service.editItem(a,projectId,id,i);}
    @PostMapping("/basis") HandoverViews.Workspace basis(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody HandoverCommands.BasisInput i){return service.setBasis(a,projectId,i);}
    @PostMapping("/submissions") HandoverViews.Workspace submit(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody HandoverCommands.Submit i){return service.submit(a,projectId,i);}
    @PostMapping("/reviews/{id}") HandoverViews.Workspace review(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody HandoverCommands.Review i){return service.review(a,projectId,id,i);}
    @PostMapping("/reopen") HandoverViews.Workspace reopen(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody HandoverCommands.Reopen i){return service.reopen(a,projectId,i);}
    @GetMapping("/packages/{id}") HandoverViews.PackageDetail pack(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id){return service.packageDetail(a,projectId,id);}
    @PostMapping("/early-start/{id}/regularize") void regularize(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody EarlyStartCommands.Finish i){service.regularize(a,projectId,id,i);}
}
