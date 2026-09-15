package com.winh.workplan.contracts;

import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;

/** Append-only facts; the current node is only the latest projection. */
@Entity @Table(name="contract_node_revision")
class ContractNodeRevision extends BusinessRecord {
    @Column(nullable=false, updatable=false) UUID contractId;
    @Column(nullable=false, updatable=false) UUID nodeId;
    @Column(nullable=false, length=32, updatable=false) String kind;
    @Column(columnDefinition="text", updatable=false) String beforeSnapshot;
    @Column(nullable=false, columnDefinition="text", updatable=false) String afterSnapshot;
    @Column(nullable=false, length=2000, updatable=false) String reason;
    @Column(updatable=false) UUID recordedBy;
}
