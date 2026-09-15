package com.winh.workplan.business;

import com.winh.workplan.iam.audit.*;
import com.winh.workplan.iam.shared.CorrelationIdHolder;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BusinessHistory {
    private final BusinessEventRepository events;
    private final AuditRecorder audit;
    private final BusinessAccess access;
    public BusinessHistory(BusinessEventRepository events, AuditRecorder audit, BusinessAccess access) {
        this.events = events; this.audit = audit; this.access = access;
    }
    @Transactional
    public void record(UUID id, String domain, String action, String description, UUID actor) {
        events.save(new BusinessEvent(id, domain, action, description, actor));
        audit.record(new AuditEventCommand(action, actor, domain, id, AuditOutcome.SUCCEEDED,
            CorrelationIdHolder.currentOrCreate(), description, null, null));
    }
    /** Call only after the owning module has authorized access to the object. */
    @Transactional(readOnly = true)
    public List<EventView> list(UUID objectId) {
        return events.findAllByObjectIdOrderByCreatedAtDesc(objectId).stream()
            .map(e -> new EventView(e.id, e.action, e.description, e.actorId, access.name(e.actorId), e.createdAt)).toList();
    }
    public record EventView(UUID id, String action, String description, UUID actorId, String actorName, Instant createdAt) {}
}
