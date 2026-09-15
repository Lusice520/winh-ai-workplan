package com.winh.workplan.requirements;
import com.winh.workplan.business.BusinessRecord;
import java.util.UUID;
import java.time.*;
import jakarta.persistence.*;
@Entity @Table(name="requirement_link")
class RequirementLink extends BusinessRecord {
    @Column(nullable=false) UUID requirementId;
    @Column(nullable=false) UUID workItemId;
    @Column(nullable=false,length=24) String kind;
    @Column(nullable=false) boolean active;
    protected RequirementLink(){}
}
