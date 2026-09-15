package com.winh.workplan.crm;

import java.util.List;
import java.util.UUID;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.PageResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import static com.winh.workplan.crm.CrmCommands.*;
import static com.winh.workplan.crm.CrmViews.*;

@RestController
@RequestMapping("/api/crm")
class CrmController {
    private final CrmService service;
    CrmController(CrmService service) { this.service = service; }
    @GetMapping("/customers")
    PageResponse<CustomerView> customers(@AuthenticationPrincipal SessionPrincipal actor,
            @RequestParam(required = false) String q, @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int pageSize) {
        return service.customers(actor, q, status, page, pageSize);
    }
    @GetMapping("/customers/duplicates") List<CustomerView> duplicates(@AuthenticationPrincipal SessionPrincipal actor,
            @RequestParam(required = false) String q, @RequestParam(required = false) String identifier) {
        return service.duplicates(actor, q, identifier);
    }
    @GetMapping("/customers/{id}") CustomerDetail customer(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id) { return service.customer(actor, id); }
    @PostMapping("/customers") CustomerDetail createCustomer(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody CustomerInput input) { return service.createCustomer(actor, input); }
    @PatchMapping("/customers/{id}") CustomerDetail updateCustomer(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @Valid @RequestBody CustomerInput input) { return service.updateCustomer(actor, id, input); }
    @PostMapping("/customers/{id}/contacts") CustomerDetail addContact(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @Valid @RequestBody ContactInput input) { return service.saveContact(actor, id, null, input); }
    @PatchMapping("/customers/{id}/contacts/{contactId}") CustomerDetail updateContact(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @PathVariable UUID contactId, @Valid @RequestBody ContactInput input) { return service.saveContact(actor, id, contactId, input); }
    @PostMapping("/customers/{id}/merge-preview") MergePreview preview(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @Valid @RequestBody MergePreviewInput input) { return service.mergePreview(actor, id, input.sourceId()); }
    @PostMapping("/customers/{id}/merge") CustomerDetail merge(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @Valid @RequestBody MergeInput input) { return service.merge(actor, id, input); }
    @GetMapping("/opportunities") PageResponse<OpportunityView> opportunities(@AuthenticationPrincipal SessionPrincipal actor,
            @RequestParam(required = false) String q, @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID customerId, @RequestParam(required = false) String grade,
            @RequestParam(required = false) String health, @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) { return service.opportunities(actor, q, status, customerId, grade, health, page, pageSize); }
    @GetMapping("/opportunities/{id}") OpportunityDetail opportunity(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id) { return service.opportunity(actor, id); }
    @PostMapping("/opportunities") OpportunityDetail createOpportunity(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody OpportunityInput input) { return service.createOpportunity(actor, input); }
    @PatchMapping("/opportunities/{id}") OpportunityDetail updateOpportunity(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @Valid @RequestBody OpportunityInput input) { return service.updateOpportunity(actor, id, input); }
    @PostMapping("/opportunities/{id}/classification") OpportunityDetail classify(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @Valid @RequestBody ClassificationInput input) { return service.classify(actor, id, input); }
    @PostMapping("/opportunities/{id}/activities") OpportunityDetail activity(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @Valid @RequestBody ActivityInput input) { return service.recordActivity(actor, id, input); }
    @PostMapping("/opportunities/{id}/result") OpportunityDetail result(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @Valid @RequestBody ResultInput input) { return service.result(actor, id, input); }
    @PostMapping("/opportunities/{id}/reopen") OpportunityDetail reopen(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @Valid @RequestBody ReopenInput input) { return service.reopen(actor, id, input); }
    record MergePreviewInput(@jakarta.validation.constraints.NotNull UUID sourceId) {}
}
