package com.winh.workplan.iam.authorization;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RolePermissionGrantRepository extends JpaRepository<RolePermissionGrant, UUID> {

	List<RolePermissionGrant> findAllByRoleIdInAndPermissionItemId(Collection<UUID> roleIds, UUID permissionItemId);

	List<RolePermissionGrant> findAllByRoleIdOrderByPermissionItemCodeAsc(UUID roleId);

	long countByPermissionItemId(UUID permissionItemId);
}
