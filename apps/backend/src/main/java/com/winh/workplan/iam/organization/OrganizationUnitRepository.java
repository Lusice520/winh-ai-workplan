package com.winh.workplan.iam.organization;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationUnitRepository extends JpaRepository<OrganizationUnit, UUID> {

	List<OrganizationUnit> findAllByOrderBySortOrderAscNameAsc();

	boolean existsByCodeIgnoreCase(String code);

	boolean existsByParentIdAndNameIgnoreCase(UUID parentId, String name);

	boolean existsByParentIsNullAndNameIgnoreCase(String name);

	long countByParentIdAndStatus(UUID parentId, OrganizationUnitStatus status);

	Optional<OrganizationUnit> findByIdAndStatus(UUID id, OrganizationUnitStatus status);
}
