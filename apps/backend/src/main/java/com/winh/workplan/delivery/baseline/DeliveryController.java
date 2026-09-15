package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.delivery.baseline.DeliveryCommands.*;
import static com.winh.workplan.delivery.baseline.DeliveryViews.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.winh.workplan.delivery.DeliveryConfigurationDirectory.PublishedConfiguration;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.PageResponse;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

@RestController @RequestMapping("/api/delivery-initiation")
class DeliveryController {
    private final DeliveryStore s;private final DeliveryPreparationService preparation;private final DeliveryReviewService review;
    private final DeliveryResourceService resources;private final DeliveryFindingService findings;
    DeliveryController(DeliveryStore s,DeliveryPreparationService preparation,DeliveryReviewService review,
            DeliveryResourceService resources,DeliveryFindingService findings){this.s=s;this.preparation=preparation;this.review=review;this.resources=resources;this.findings=findings;}
    @Transactional(readOnly=true)
    @GetMapping PageResponse<Row> list(@AuthenticationPrincipal SessionPrincipal actor,@RequestParam(required=false)String q,
            @RequestParam(required=false)String status,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="10")int pageSize){return s.list(actor,q,status,page,pageSize);}
    @Transactional(readOnly=true)
    @GetMapping("/{projectId}") Workspace workspace(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId){return s.workspace(a,projectId);}
    @Transactional(readOnly=true)
    @GetMapping("/{projectId}/configurations") List<PublishedConfiguration> configurations(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestParam String kind){return s.configurations.available(a,projectId,kind);}
    @Transactional(readOnly=true)
    @GetMapping("/{projectId}/work-packages") Object workPackages(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId){
        s.projects.requireReadable(a,projectId,"DG2_READ");return s.work.list(a,projectId,"WORK_PACKAGE");}
    @Transactional(readOnly=true)
    @GetMapping("/{projectId}/contract-nodes") Object contractNodes(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId){
        s.projects.requireReadable(a,projectId,"DG2_READ");return s.contracts.nodeOptions(a,projectId);}
    @Transactional(readOnly=true)
    @GetMapping("/{projectId}/rounds/{id}") Snapshot round(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id){return s.reviewSnapshot(a,projectId,id);}
    @Transactional(readOnly=true)
    @GetMapping("/{projectId}/baselines/{id}") Snapshot baseline(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id){return s.baselineSnapshot(a,projectId,id);}
    @Transactional(readOnly=true)
    @GetMapping("/{projectId}/objects/{id}/history") List<Revision> history(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id){return s.revisionHistory(a,projectId,id);}
    @Transactional(readOnly=true)
    @GetMapping("/{projectId}/resources/{id}/overlaps") List<Overlap> overlaps(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id){return resources.overlaps(a,projectId,id);}
    @PostMapping("/{projectId}/initialize") Workspace initialize(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody JsonNode body){return preparation.initialize(a,projectId,s.codec.command(body,Initialize.class));}
    @PatchMapping("/{projectId}/header") Workspace header(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody JsonNode body){return preparation.header(a,projectId,s.codec.command(body,UpdateHeader.class));}
    @PostMapping("/{projectId}/source-refresh") Workspace source(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody JsonNode body){return preparation.refreshSource(a,projectId,s.codec.command(body,Submit.class));}
    @PostMapping("/{projectId}/configuration") Workspace select(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody JsonNode body){return preparation.select(a,projectId,s.codec.command(body,SelectConfiguration.class));}
    @PostMapping("/{projectId}/objects") Workspace createObject(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody JsonNode body){return preparation.save(a,projectId,null,s.codec.command(body,SaveObject.class));}
    @PatchMapping("/{projectId}/objects/{id}") Workspace updateObject(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return preparation.save(a,projectId,id,s.codec.command(body,SaveObject.class));}
    @PostMapping("/{projectId}/objects/{id}/archive") Workspace archive(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return preparation.archive(a,projectId,id,s.codec.command(body,ArchiveObject.class));}
    @PostMapping("/{projectId}/resources") Workspace createResource(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody JsonNode body){return resources.save(a,projectId,null,s.codec.command(body,SaveResource.class));}
    @PatchMapping("/{projectId}/resources/{id}") Workspace updateResource(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return resources.save(a,projectId,id,s.codec.command(body,SaveResource.class));}
    @PostMapping("/{projectId}/resources/{id}/commit") Workspace commit(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return resources.commit(a,projectId,id,s.codec.command(body,CommitResource.class));}
    @PostMapping("/{projectId}/findings") Workspace createFinding(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody JsonNode body){return findings.save(a,projectId,null,s.codec.command(body,SaveFinding.class));}
    @PatchMapping("/{projectId}/findings/{id}") Workspace updateFinding(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return findings.save(a,projectId,id,s.codec.command(body,SaveFinding.class));}
    @PostMapping("/{projectId}/findings/{id}/resolve") Workspace resolve(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return findings.resolve(a,projectId,id,s.codec.command(body,ResolveFinding.class));}
    @PostMapping("/{projectId}/submit") Workspace submit(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody JsonNode body){return review.submit(a,projectId,s.codec.command(body,Submit.class));}
    @PostMapping("/{projectId}/rounds/{id}/review") Workspace review(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return review.review(a,projectId,id,s.codec.command(body,Decision.class));}
    @PostMapping("/{projectId}/rounds/{id}/decision") Workspace decide(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return review.decide(a,projectId,id,s.codec.command(body,Decision.class));}
    @PostMapping("/{projectId}/rounds/{id}/withdraw") Workspace withdraw(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return review.withdraw(a,projectId,id,s.codec.command(body,Decision.class));}
    @PostMapping("/{projectId}/changes/{id}/decision") Workspace decideChange(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return review.decideChange(a,projectId,id,s.codec.command(body,DecideChange.class));}
}
