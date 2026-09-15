package com.winh.workplan.project;
import java.util.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
interface ProjectRepository extends JpaRepository<ProjectSpace, UUID> {
    Optional<ProjectSpace> findByOpportunityId(UUID opportunityId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from ProjectSpace p where p.id = :id")
    Optional<ProjectSpace> lockById(@Param("id") UUID id);
}
