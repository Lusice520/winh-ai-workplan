package com.winh.workplan.requirements;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
interface ProjectRequirementRepository extends JpaRepository<ProjectRequirement,UUID>{
    List<ProjectRequirement> findAllByProjectIdInOrderByUpdatedAtDesc(Collection<UUID> projectIds);
}
