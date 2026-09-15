package com.winh.workplan.execution;
import com.winh.workplan.iam.identity.SessionPrincipal;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/projects/{projectId}/execution")
class ExecutionController {
    private final ExecutionQueryService query;private final StageExecutionService stages;private final ItemExecutionService items;private final MilestoneExecutionService milestones;
    ExecutionController(ExecutionQueryService query,StageExecutionService stages,ItemExecutionService items,MilestoneExecutionService milestones){this.query=query;this.stages=stages;this.items=items;this.milestones=milestones;}
    @GetMapping ExecutionViews.Workspace workspace(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId){return query.workspace(actor,projectId);}
    @GetMapping("/items/{id}") ExecutionViews.ItemDetail item(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id){return query.itemDetail(actor,projectId,id);}
    @GetMapping("/history/{id}") List<ExecutionViews.Event> history(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id){return query.history(actor,projectId,id);}
    @PostMapping("/stages/{id}/actions") ExecutionViews.Workspace stage(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody ExecutionCommands.StageCommand input){stages.transition(actor,projectId,id,input);return query.workspace(actor,projectId);}
    @PostMapping("/items/{id}/profile") ExecutionViews.ItemDetail profile(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody ExecutionCommands.ProfileCommand input){items.profile(actor,projectId,id,input);return query.itemDetail(actor,projectId,id);}
    @PostMapping("/items/{id}/events") ExecutionViews.ItemDetail record(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody ExecutionCommands.ItemCommand input){items.record(actor,projectId,id,input);return query.itemDetail(actor,projectId,id);}
    @PostMapping("/events/{id}/actions") ExecutionViews.Workspace decision(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody ExecutionCommands.Decision input){items.decide(actor,projectId,id,input);return query.workspace(actor,projectId);}
    @PostMapping("/milestones/{id}/submit") ExecutionViews.Workspace submit(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody ExecutionCommands.MilestoneCommand input){milestones.submit(actor,projectId,id,input);return query.workspace(actor,projectId);}
    @PostMapping("/milestones/{id}/actions") ExecutionViews.Workspace milestone(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@Valid @RequestBody ExecutionCommands.Decision input){milestones.decide(actor,projectId,id,input);return query.workspace(actor,projectId);}
}
