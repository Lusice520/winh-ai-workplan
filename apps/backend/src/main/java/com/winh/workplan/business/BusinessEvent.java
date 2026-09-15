package com.winh.workplan.business;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "business_event", indexes = @Index(columnList = "object_id,created_at"))
class BusinessEvent {
    @Id UUID id = UUID.randomUUID();
    @Column(nullable = false) UUID objectId;
    @Column(nullable = false, length = 40) String domain;
    @Column(nullable = false, length = 80) String action;
    @Column(nullable = false, length = 4000) String description;
    @Column(nullable = false) UUID actorId;
    @Column(nullable = false) Instant createdAt = Instant.now();
    protected BusinessEvent() {}
    BusinessEvent(UUID objectId, String domain, String action, String description, UUID actorId) {
        this.objectId = objectId; this.domain = domain; this.action = action;
        this.description = description; this.actorId = actorId;
    }
}
