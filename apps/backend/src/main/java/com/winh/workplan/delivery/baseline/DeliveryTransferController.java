package com.winh.workplan.delivery.baseline;
import static com.winh.workplan.delivery.baseline.DeliveryTransfers.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.winh.workplan.iam.identity.SessionPrincipal;
import java.util.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/delivery-initiation/{projectId}/responsibility-transfers")
class DeliveryTransferController {
    final DeliveryTransferService service;final DeliveryCodec codec;
    DeliveryTransferController(DeliveryTransferService service,DeliveryCodec codec){this.service=service;this.codec=codec;}
    @GetMapping List<View> list(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId){return service.list(actor,projectId);}
    @GetMapping("/preview") Preview preview(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@RequestParam UUID fromId,@RequestParam UUID toId){return service.preview(actor,projectId,fromId,toId);}
    @GetMapping("/{id}/resources/{resourceId}/overlaps") Overlaps overlaps(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@PathVariable UUID resourceId){return service.overlaps(actor,projectId,id,resourceId);}
    @PostMapping View create(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@RequestBody JsonNode body){return service.create(actor,projectId,codec.command(body,Create.class));}
    @PostMapping("/{id}/decision") View decide(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return service.decide(actor,projectId,id,codec.command(body,Decide.class));}
    @PostMapping("/{id}/resources/sign") View sign(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID projectId,@PathVariable UUID id,@RequestBody JsonNode body){return service.sign(actor,projectId,id,codec.command(body,Sign.class));}
}
