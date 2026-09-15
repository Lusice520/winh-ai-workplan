package com.winh.workplan.business;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;

@MappedSuperclass
public abstract class BusinessRecord {
    @Id public UUID id = UUID.randomUUID();
    @Version public long version;
    @Column(nullable = false) public Instant createdAt = Instant.now();
    @Column(nullable = false) public Instant updatedAt = createdAt;

    public void touch() { updatedAt = Instant.now(); }
}
