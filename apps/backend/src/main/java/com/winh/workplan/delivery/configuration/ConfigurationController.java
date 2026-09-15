package com.winh.workplan.delivery.configuration;

import static com.winh.workplan.delivery.configuration.ConfigurationCommands.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.PageResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/delivery-configurations")
class ConfigurationController {
    private final ConfigurationService service;
    private final ConfigurationCodec codec;
    ConfigurationController(ConfigurationService service, ConfigurationCodec codec) { this.service = service; this.codec = codec; }
    @GetMapping("/capabilities") List<String> capabilities(@AuthenticationPrincipal SessionPrincipal actor) { return service.capabilities(actor); }
    @GetMapping PageResponse<ConfigurationViews.Row> list(@AuthenticationPrincipal SessionPrincipal actor,
            @RequestParam(required = false) String q, @RequestParam(required = false) String kind,
            @RequestParam(required = false) String status, @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) { return service.list(actor, q, kind, status, page, pageSize); }
    @GetMapping("/{id}") ConfigurationViews.Detail detail(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id) { return service.detail(actor, id); }
    @PostMapping ConfigurationViews.Detail create(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody JsonNode body) {
        return service.create(actor, codec.command(body, Create.class));
    }
    @PatchMapping("/{id}") ConfigurationViews.Detail update(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @RequestBody JsonNode body) {
        return service.update(actor, id, codec.command(body, Update.class));
    }
    @PostMapping("/{id}/next-version") ConfigurationViews.Detail next(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @RequestBody JsonNode body) {
        return service.nextVersion(actor, id, codec.command(body, Transition.class));
    }
    @PostMapping("/{id}/publish") ConfigurationViews.Detail publish(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @RequestBody JsonNode body) {
        return service.publish(actor, id, codec.command(body, Transition.class));
    }
    @PostMapping("/{id}/retire") ConfigurationViews.Detail retire(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable UUID id, @RequestBody JsonNode body) {
        return service.retire(actor, id, codec.command(body, Transition.class));
    }
}
