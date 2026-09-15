package com.winh.workplan.project;
import com.winh.workplan.business.BusinessRecord;
import java.util.UUID;
import jakarta.persistence.*;

@Entity @Table(name = "project_space")
class ProjectSpace extends BusinessRecord {
    @Column(nullable = false, unique = true, length = 40) String code;
    @Column(nullable = false, unique = true) UUID opportunityId;
    @Column(nullable = false, length = 160) String name;
    @Column(nullable = false) UUID salesOwnerId;
    @Column(nullable = false) UUID presalesOwnerId;
    @Column(nullable = false) UUID organizationUnitId;
    @Column(nullable = false, length = 24) String mainStage = "PRESALES";
    @Column(nullable = false, length = 80) String focus = "NOT_SET";
    @Column(nullable = false, length = 32) String status = "PENDING_INITIATION";
    @Column(length = 32) String statusBeforeClose;
    @Column(length = 8000) String background;
    protected ProjectSpace() {}
}
