package com.winh.workplan.requirements;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface RequirementLinkRepository extends JpaRepository<RequirementLink,UUID>{
    List<RequirementLink> findAllByRequirementIdOrderByCreatedAtAsc(UUID requirementId);
}
