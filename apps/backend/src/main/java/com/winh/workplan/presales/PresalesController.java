package com.winh.workplan.presales;
import static com.winh.workplan.presales.PresalesCommands.*;
import com.winh.workplan.presales.PresalesViews.Workspace;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.UUID;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/projects/{projectId}/presales")
class PresalesController {
    private final PresalesService service;
    PresalesController(PresalesService service){this.service=service;}
    @GetMapping Workspace get(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId){return service.workspace(actor,projectId);}
    @PostMapping("/initiations") Workspace create(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@Valid @RequestBody InitiationInput input){return service.saveInitiation(actor,projectId,null,input);}
    @PatchMapping("/initiations/{id}") Workspace edit(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody InitiationInput input){return service.saveInitiation(actor,projectId,id,input);}
    @PostMapping("/initiations/{id}/submit") Workspace submit(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody SubmitInput input){return service.submitInitiation(actor,projectId,id,input);}
    @PostMapping("/initiations/{id}/review") Workspace review(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody ReviewInput input){return service.reviewInitiation(actor,projectId,id,input);}
    @PatchMapping("/actions/{id}") Workspace action(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody ActionInput input){return service.updateAction(actor,projectId,id,input);}
    @PostMapping("/actions/{id}/deliverables") Workspace deliver(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody DeliverableInput input){return service.deliver(actor,projectId,id,input);}
    @PostMapping("/investments") Workspace invest(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@Valid @RequestBody InvestmentInput input){return service.invest(actor,projectId,input);}
    @PostMapping("/quote-reviews") Workspace quote(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@Valid @RequestBody QuoteInput input){return service.submitQuote(actor,projectId,input);}
    @PostMapping("/quote-reviews/{id}/review") Workspace quoteReview(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody ReviewInput input){return service.reviewQuote(actor,projectId,id,input);}
}
