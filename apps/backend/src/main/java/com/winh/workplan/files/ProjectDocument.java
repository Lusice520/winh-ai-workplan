package com.winh.workplan.files;
import com.winh.workplan.business.BusinessRecord;
import jakarta.persistence.*;
import java.util.UUID;
@Entity @Table(name = "project_document")
class ProjectDocument extends BusinessRecord {
    @Column(nullable = false) UUID projectId;
    @Column(nullable = false, length = 160) String title;
    @Column(nullable = false, length = 40) String kind;
    @Column(nullable = false, length = 24) String mainStage;
    @Column(nullable = false, length = 24) String classification;
    UUID currentVersionId;
    @Column(nullable = false) UUID createdBy;
}
