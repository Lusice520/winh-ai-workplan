package com.winh.workplan.handover;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/projects/{projectId}/early-start")
class EarlyStartController {
    private final EarlyStartService service;
    EarlyStartController(EarlyStartService service){this.service=service;}
    @GetMapping EarlyStartViews.Workspace get(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId){return service.workspace(a,projectId);}
    @PostMapping EarlyStartViews.Workspace create(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody EarlyStartCommands.ApplicationInput i){return service.save(a,projectId,null,i);}
    @PatchMapping("/{id}") EarlyStartViews.Workspace edit(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody EarlyStartCommands.ApplicationInput i){return service.save(a,projectId,id,i);}
    @PostMapping("/{id}/submissions") EarlyStartViews.Workspace submit(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody EarlyStartCommands.Submit i){return service.submit(a,projectId,id,i);}
    @PostMapping("/{id}/reviews/{reviewId}") EarlyStartViews.Workspace review(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@PathVariable UUID reviewId,@RequestBody EarlyStartCommands.Review i){return service.review(a,projectId,id,reviewId,i);}
    @PostMapping("/{id}/ledger") EarlyStartViews.Workspace record(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody EarlyStartCommands.LedgerInput i){return service.record(a,projectId,id,i);}
    @PostMapping("/{id}/closure-allowances") EarlyStartViews.Workspace allowance(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody EarlyStartCommands.AllowanceInput i){return service.authorizeClosure(a,projectId,id,i);}
    @PostMapping("/{id}/close") EarlyStartViews.Workspace close(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody EarlyStartCommands.Finish i){return service.close(a,projectId,id,i);}
}
