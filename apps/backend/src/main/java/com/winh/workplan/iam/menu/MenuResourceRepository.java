package com.winh.workplan.iam.menu;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuResourceRepository extends JpaRepository<MenuResource, UUID> {

	Optional<MenuResource> findByCode(String code);

	List<MenuResource> findAllByOrderBySortOrderAscNameAsc();

	List<MenuResource> findAllByStatusOrderBySortOrderAscNameAsc(MenuResourceStatus status);
}
