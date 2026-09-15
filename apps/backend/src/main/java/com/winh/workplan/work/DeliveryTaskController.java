package com.winh.workplan.work;
import com.winh.workplan.iam.identity.SessionPrincipal;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/projects/{projectId}")
class DeliveryTaskController {
    private final DeliveryTaskService service;private final DeliveryTaskQuery query;
    DeliveryTaskController(DeliveryTaskService service,DeliveryTaskQuery query){this.service=service;this.query=query;}
    @GetMapping("/work-packages/{id}/tasks") DeliveryTaskViews.Workspace workspace(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id){return query.workspace(actor,projectId,id);}
    @PostMapping("/work-packages/{id}/tasks") DeliveryTaskViews.Detail create(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody DeliveryTaskCommands.Plan input){return query.detail(actor,projectId,service.create(actor,projectId,id,input));}
    @GetMapping("/tasks/{id}") DeliveryTaskViews.Detail detail(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id){return query.detail(actor,projectId,id);}
    @PatchMapping("/tasks/{id}") DeliveryTaskViews.Detail edit(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody DeliveryTaskCommands.Plan input){service.edit(actor,projectId,id,input);return query.detail(actor,projectId,id);}
    @PostMapping("/tasks/{id}/commands") DeliveryTaskViews.Detail command(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody DeliveryTaskCommands.Action input){service.act(actor,projectId,id,input);return query.detail(actor,projectId,id);}
}
