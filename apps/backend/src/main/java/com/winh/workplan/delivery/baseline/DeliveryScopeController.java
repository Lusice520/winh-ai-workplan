package com.winh.workplan.delivery.baseline;

import static com.winh.workplan.delivery.baseline.DeliveryScopes.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/delivery-initiation/{projectId}/scope-changes")
class DeliveryScopeController {
    private final DeliveryScopeService service;
    private final DeliveryCodec codec;
    DeliveryScopeController(DeliveryScopeService service,DeliveryCodec codec){this.service=service;this.codec=codec;}
    @GetMapping List<Row> list(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId){return service.list(a,projectId);}
    @GetMapping("/{id}") View detail(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id){return service.detail(a,projectId,id);}
    @GetMapping("/{id}/submissions/{roundId}") Frozen snapshot(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@PathVariable UUID roundId){return service.snapshot(a,projectId,id,roundId);}
    @GetMapping("/{id}/resources/{resourceId}/overlaps") Object overlaps(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@PathVariable UUID resourceId){return service.overlaps(a,projectId,id,resourceId);}
    @PostMapping View create(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@RequestBody JsonNode body){return service.create(a,projectId,codec.command(body,Metadata.class));}
    @PatchMapping("/{id}") View metadata(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return service.metadata(a,projectId,id,codec.command(body,Metadata.class));}
    @PostMapping("/{id}/objects") View createObject(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return service.saveObject(a,projectId,id,null,codec.command(body,DeliveryCommands.SaveObject.class));}
    @PatchMapping("/{id}/objects/{objectId}") View editObject(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@PathVariable UUID objectId,@RequestBody JsonNode body){return service.saveObject(a,projectId,id,objectId,codec.command(body,DeliveryCommands.SaveObject.class));}
    @PostMapping("/{id}/objects/{objectId}/archive") View archive(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@PathVariable UUID objectId,@RequestBody JsonNode body){return service.archiveObject(a,projectId,id,objectId,codec.command(body,DeliveryCommands.ArchiveObject.class));}
    @PostMapping("/{id}/resources") View createResource(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return service.saveResource(a,projectId,id,null,codec.command(body,ResourceSave.class));}
    @PatchMapping("/{id}/resources/{resourceId}") View editResource(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@PathVariable UUID resourceId,@RequestBody JsonNode body){return service.saveResource(a,projectId,id,resourceId,codec.command(body,ResourceSave.class));}
    @PostMapping("/{id}/resources/{resourceId}/commit") View sign(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@PathVariable UUID resourceId,@RequestBody JsonNode body){return service.signResource(a,projectId,id,resourceId,codec.command(body,DeliveryCommands.CommitResource.class));}
    @PostMapping("/{id}/actions") View action(@AuthenticationPrincipal SessionPrincipal a,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return service.action(a,projectId,id,codec.command(body,Action.class));}
}
