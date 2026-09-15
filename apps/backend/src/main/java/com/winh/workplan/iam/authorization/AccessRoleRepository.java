package com.winh.workplan.iam.authorization;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AccessRoleRepository extends JpaRepository<AccessRole, UUID> {

	Optional<AccessRole> findByCode(String code);

	List<AccessRole> findAllByRoleTypeOrderByNameAsc(AccessRoleType roleType);

	List<AccessRole> findAllByStatusOrderByNameAsc(AccessRoleStatus status);
}
