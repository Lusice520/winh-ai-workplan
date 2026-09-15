package com.winh.workplan.contracts;
import static com.winh.workplan.contracts.ContractCommands.*;
import static com.winh.workplan.contracts.ContractViews.*;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.PageResponse;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/contracts")
class ContractController {
    private final ContractService service;
    ContractController(ContractService service){this.service=service;}
    @GetMapping PageResponse<Master> list(@AuthenticationPrincipal SessionPrincipal actor,@RequestParam(required=false) String q,
        @RequestParam(required=false) UUID projectId,@RequestParam(required=false) String status,@RequestParam(required=false) String archiveStatus,
        @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int pageSize){return service.list(actor,q,projectId,status,archiveStatus,page,pageSize);}
    @GetMapping("/{id}") Detail detail(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id){return service.detail(actor,id);}
    @PostMapping Detail create(@AuthenticationPrincipal SessionPrincipal actor,@RequestBody MasterInput input){return service.create(actor,input);}
    @PatchMapping("/{id}") Detail edit(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@RequestBody MasterInput input){return service.edit(actor,id,input);}
    @PostMapping("/{id}/nodes") Detail node(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@RequestBody NodeInput input){return service.addNode(actor,id,input);}
    @PostMapping("/{id}/nodes/{nodeId}/complete") Detail complete(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@PathVariable UUID nodeId,@RequestBody CompleteNode input){return service.completeNode(actor,id,nodeId,input);}
    @PostMapping("/{id}/nodes/{nodeId}/corrections") Detail correctNode(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@PathVariable UUID nodeId,@RequestBody CorrectNode input){return service.correctNode(actor,id,nodeId,input);}
    @PostMapping("/{id}/records") Detail record(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@RequestBody RecordInput input){return service.addRecord(actor,id,input);}
    @PostMapping("/{id}/files") Detail file(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@RequestBody LinkFile input){return service.linkFile(actor,id,input);}
    @PostMapping("/{id}/archive-submissions") Detail submit(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@RequestBody SubmitArchive input){return service.submit(actor,id,input);}
    @PostMapping("/{id}/archive-reviews/{reviewId}") Detail review(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@PathVariable UUID reviewId,@RequestBody ReviewArchive input){return service.review(actor,id,reviewId,input);}
    @PostMapping("/{id}/make-primary") Detail primary(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable UUID id,@RequestBody MakePrimary input){return service.makePrimary(actor,id,input);}
}
