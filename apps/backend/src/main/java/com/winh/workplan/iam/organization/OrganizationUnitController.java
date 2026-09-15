package com.winh.workplan.iam.organization;

import java.util.List;
import java.util.UUID;

import com.winh.workplan.iam.identity.SessionPrincipal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/iam/organization-units")
public class OrganizationUnitController {

	private final OrganizationDirectoryService organizationDirectoryService;

	OrganizationUnitController(OrganizationDirectoryService organizationDirectoryService) {
		this.organizationDirectoryService = organizationDirectoryService;
	}

	@GetMapping("/tree")
	public List<OrganizationUnitResponse> readTree() {
		return organizationDirectoryService.readTree();
	}

	@PostMapping
	public ResponseEntity<OrganizationUnitResponse> create(
			@Valid @RequestBody OrganizationUnitRequest request,
			Authentication authentication) {
		OrganizationUnitResponse response = organizationDirectoryService.create(
				new CreateOrganizationUnitCommand(
						request.name(),
						request.code(),
						request.unitType(),
						request.parentId(),
						request.managerAccountId(),
						request.sortOrder(),
						request.status()),
				principal(authentication).accountId());
		return ResponseEntity.status(201).body(response);
	}

	@PatchMapping("/{unitId}")
	public OrganizationUnitResponse update(
			@PathVariable UUID unitId,
			@Valid @RequestBody UpdateOrganizationUnitRequest request,
			Authentication authentication) {
		return organizationDirectoryService.update(
				unitId,
				new UpdateOrganizationUnitCommand(
						request.name(),
						request.code(),
						request.parentId(),
						request.managerAccountId(),
						request.sortOrder(),
						request.version()),
				principal(authentication).accountId());
	}

	@PostMapping("/{unitId}/status-transitions")
	public OrganizationUnitResponse transitionStatus(
			@PathVariable UUID unitId,
			@Valid @RequestBody OrganizationUnitStatusTransitionRequest request,
			Authentication authentication) {
		return organizationDirectoryService.changeStatus(
				unitId,
				request.targetStatus(),
				request.reason(),
				request.version(),
				principal(authentication).accountId());
	}

	private SessionPrincipal principal(Authentication authentication) {
		return (SessionPrincipal) authentication.getPrincipal();
	}

	public record OrganizationUnitRequest(
			@NotBlank(message = "请输入部门名称。") String name,
			@NotBlank(message = "请输入部门编码。") String code,
			@NotNull(message = "请选择组织类型。") OrganizationUnitType unitType,
			UUID parentId,
			UUID managerAccountId,
			@PositiveOrZero(message = "排序不能小于 0。") int sortOrder,
			OrganizationUnitStatus status) {
	}

	public record UpdateOrganizationUnitRequest(
			@NotBlank(message = "请输入部门名称。") String name,
			@NotBlank(message = "请输入部门编码。") String code,
			UUID parentId,
			UUID managerAccountId,
			@PositiveOrZero(message = "排序不能小于 0。") int sortOrder,
			@PositiveOrZero(message = "缺少当前版本。") long version) {
	}

	public record OrganizationUnitStatusTransitionRequest(
			@NotNull(message = "请选择部门状态。") OrganizationUnitStatus targetStatus,
			@NotBlank(message = "请填写变更原因。") String reason,
			@PositiveOrZero(message = "缺少当前版本。") long version) {
	}
}
