package com.winh.workplan.business;

import java.util.List;
import com.winh.workplan.iam.identity.SessionPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/business")
class BusinessDirectoryController {
    private final BusinessAccess access;
    BusinessDirectoryController(BusinessAccess access) { this.access = access; }
    @GetMapping("/capabilities")
    java.util.List<String> capabilities(@AuthenticationPrincipal SessionPrincipal actor) {
        return access.actions(actor, access.creation(actor), "CRM_CUSTOMER_CREATE", "CRM_OPPORTUNITY_CREATE", "PROJECT_CREATE", "CONTRACT_EDIT");
    }
    @GetMapping("/people")
    List<BusinessAccess.Person> people(@AuthenticationPrincipal SessionPrincipal actor) {
        return access.people(actor);
    }
}
