package com.winh.workplan.requirements;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface RequirementAssessmentRepository extends JpaRepository<RequirementAssessment,UUID>{
    List<RequirementAssessment> findAllByRequirementIdOrderByCreatedAtDesc(UUID requirementId);
}
