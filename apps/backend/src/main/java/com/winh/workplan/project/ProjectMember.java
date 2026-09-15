package com.winh.workplan.project;
import com.winh.workplan.business.BusinessRecord;
import java.util.UUID;
import jakarta.persistence.*;

@Entity @Table(name = "project_member", uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "account_id"}))
class ProjectMember extends BusinessRecord {
    @Column(nullable = false) UUID projectId;
    @Column(nullable = false) UUID accountId;
    @Column(nullable = false, length = 200) String roleCodes;
    @Column(nullable = false) boolean active = true;
    @Column(length = 1000) String changeReason;
    protected ProjectMember() {}
}
