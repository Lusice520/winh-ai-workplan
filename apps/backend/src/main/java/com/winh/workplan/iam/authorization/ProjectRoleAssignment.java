package com.winh.workplan.iam.authorization;

import java.util.UUID;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;

@Entity
@Table(name = "project_role_assignment", uniqueConstraints =
    @UniqueConstraint(columnNames = {"project_id", "account_id", "role_id"}))
class ProjectRoleAssignment extends BusinessRecord {
    @Column(nullable = false) UUID projectId;
    @Column(nullable = false) UUID accountId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "role_id") AccessRole role;
    @Column(nullable = false) boolean active;
    @Column(nullable = false) UUID assignedBy;
    protected ProjectRoleAssignment() {}
    ProjectRoleAssignment(UUID projectId, UUID accountId, AccessRole role, UUID actor) {
        this.projectId = projectId; this.accountId = accountId; this.role = role;
        this.assignedBy = actor; this.active = true;
    }
}
