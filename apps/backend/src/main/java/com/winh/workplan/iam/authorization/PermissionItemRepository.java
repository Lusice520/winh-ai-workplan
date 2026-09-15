package com.winh.workplan.iam.authorization;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PermissionItemRepository extends JpaRepository<PermissionItem, UUID> {

	Optional<PermissionItem> findByCode(String code);

	Optional<PermissionItem> findByMenuResourceIdAndDimension(UUID menuResourceId, PermissionDimension dimension);

	List<PermissionItem> findAllByStatusOrderByCodeAsc(PermissionItemStatus status);
}
