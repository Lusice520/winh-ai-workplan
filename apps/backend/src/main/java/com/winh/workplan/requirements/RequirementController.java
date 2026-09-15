package com.winh.workplan.requirements;
import static com.winh.workplan.requirements.RequirementCommands.*;
import static com.winh.workplan.requirements.RequirementViews.*;
import java.util.UUID;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.PageResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/requirements")
class RequirementController {
    private final RequirementService service;
    RequirementController(RequirementService service){this.service=service;}
    @GetMapping PageResponse<RequirementView> list(@AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(required=false) String q,@RequestParam(required=false) UUID projectId,@RequestParam(required=false) String status,
        @RequestParam(required=false) String source,@RequestParam(required=false) String priority,@RequestParam(required=false) UUID ownerAccountId,
        @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int pageSize){return service.list(actor,q,projectId,status,source,priority,ownerAccountId,page,pageSize);}
    @GetMapping("/{id}") Detail detail(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id){return service.detail(actor,id);}
    @PostMapping Detail create(@AuthenticationPrincipal SessionPrincipal actor,@Valid @RequestBody CreateRequirement input){return service.create(actor,input);}
    @PatchMapping("/{id}") Detail edit(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@Valid @RequestBody EditRequirement input){return service.edit(actor,id,input);}
    @PostMapping("/{id}/assess") Detail assess(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@Valid @RequestBody AssessRequirement input){return service.assess(actor,id,input);}
    @PostMapping("/{id}/route") Detail route(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@Valid @RequestBody RouteRequirement input){return service.route(actor,id,input);}
    @PostMapping("/{id}/complete") Detail complete(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@Valid @RequestBody CompleteRequirement input){return service.complete(actor,id,input);}
    @PostMapping("/{id}/verify") Detail verify(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@Valid @RequestBody VerifyRequirement input){return service.verify(actor,id,input);}
    @PostMapping("/{id}/reopen") Detail reopen(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@Valid @RequestBody ReopenRequirement input){return service.reopen(actor,id,input);}
}
