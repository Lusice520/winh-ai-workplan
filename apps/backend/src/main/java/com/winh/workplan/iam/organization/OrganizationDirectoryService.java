package com.winh.workplan.iam.organization;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.winh.workplan.iam.account.AccountStatus;
import com.winh.workplan.iam.account.UserAccountRepository;
import com.winh.workplan.iam.audit.AuditEventCommand;
import com.winh.workplan.iam.audit.AuditOutcome;
import com.winh.workplan.iam.audit.AuditRecorder;
import com.winh.workplan.iam.shared.ApiProblem;
import com.winh.workplan.iam.shared.CorrelationIdHolder;
import com.winh.workplan.iam.shared.DomainException;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class OrganizationDirectoryService {

	private final OrganizationUnitRepository organizationUnitRepository;
	private final UserAccountRepository userAccountRepository;
	private final AuditRecorder auditRecorder;

	OrganizationDirectoryService(
			OrganizationUnitRepository organizationUnitRepository,
			UserAccountRepository userAccountRepository,
			AuditRecorder auditRecorder) {
		this.organizationUnitRepository = organizationUnitRepository;
		this.userAccountRepository = userAccountRepository;
		this.auditRecorder = auditRecorder;
	}

	@Transactional(readOnly = true)
	public List<OrganizationUnitResponse> readTree() {
		List<OrganizationUnit> units = organizationUnitRepository.findAllByOrderBySortOrderAscNameAsc();
		Map<UUID, Long> accountCounts = new HashMap<>();
		userAccountRepository.findAll().forEach(account -> accountCounts.merge(
				account.getOrganizationUnit().getId(),
				1L,
				Long::sum));
		Map<UUID, List<OrganizationUnit>> childrenByParent = new HashMap<>();
		List<OrganizationUnit> roots = new ArrayList<>();
		for (OrganizationUnit unit : units) {
			if (unit.getParent() == null) {
				roots.add(unit);
			} else {
				childrenByParent.computeIfAbsent(unit.getParent().getId(), ignored -> new ArrayList<>()).add(unit);
			}
		}
		return roots.stream()
				.map(unit -> toTreeResponse(unit, childrenByParent, accountCounts))
				.toList();
	}

	@Transactional
	public OrganizationUnitResponse create(CreateOrganizationUnitCommand command, UUID actorAccountId) {
		OrganizationUnit parent = resolveParent(command.unitType(), command.parentId(), null);
		validateNameAndCode(command.name(), command.code(), parent, null);
		OrganizationUnit unit = new OrganizationUnit(
				command.name().trim(),
				normalizeCode(command.code()),
				command.unitType(),
				parent,
				command.managerAccountId(),
				command.sortOrder(),
				command.status() == null ? OrganizationUnitStatus.ENABLED : command.status());
		OrganizationUnit saved = organizationUnitRepository.saveAndFlush(unit);
		auditRecorder.record(new AuditEventCommand(
				"ORG_UNIT_CREATED",
				actorAccountId,
				"ORG_UNIT",
				saved.getId(),
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				null,
				null,
				"name=" + saved.getName()));
		return OrganizationUnitResponse.leaf(saved, 0);
	}

	@Transactional
	public OrganizationUnitResponse update(UUID unitId, UpdateOrganizationUnitCommand command, UUID actorAccountId) {
		OrganizationUnit unit = requireUnit(unitId);
		validateVersion(unit.getVersion(), command.version());
		OrganizationUnit parent = resolveParent(unit.getUnitType(), command.parentId(), unit);
		validateNameAndCode(command.name(), command.code(), parent, unit);
		unit.update(
				command.name().trim(),
				normalizeCode(command.code()),
				parent,
				command.managerAccountId(),
				command.sortOrder());
		OrganizationUnit saved = organizationUnitRepository.saveAndFlush(unit);
		auditRecorder.record(new AuditEventCommand(
				"ORG_UNIT_UPDATED",
				actorAccountId,
				"ORG_UNIT",
				saved.getId(),
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				null,
				null,
				"name=" + saved.getName()));
		return OrganizationUnitResponse.leaf(saved, directUserCount(saved.getId()));
	}

	@Transactional
	public OrganizationUnitResponse changeStatus(
			UUID unitId,
			OrganizationUnitStatus nextStatus,
			String reason,
			long version,
			UUID actorAccountId) {
		OrganizationUnit unit = requireUnit(unitId);
		validateVersion(unit.getVersion(), version);
		if (nextStatus == OrganizationUnitStatus.DISABLED) {
			if (organizationUnitRepository.countByParentIdAndStatus(unitId, OrganizationUnitStatus.ENABLED) > 0) {
				throw conflict("ORGANIZATION_HAS_ENABLED_CHILDREN", "停用前请先处理启用中的下级部门。", "status");
			}
			if (userAccountRepository.countByOrganizationUnitIdAndAccountStatus(unitId, AccountStatus.ENABLED) > 0) {
				throw conflict("ORGANIZATION_HAS_ENABLED_ACCOUNTS", "停用前请先处理该部门中的启用账号。", "status");
			}
		}
		OrganizationUnitStatus previous = unit.getStatus();
		unit.changeStatus(nextStatus);
		OrganizationUnit saved = organizationUnitRepository.saveAndFlush(unit);
		auditRecorder.record(new AuditEventCommand(
				"ORG_UNIT_STATUS_CHANGED",
				actorAccountId,
				"ORG_UNIT",
				saved.getId(),
				AuditOutcome.SUCCEEDED,
				CorrelationIdHolder.currentOrCreate(),
				reason.trim(),
				previous.name(),
				nextStatus.name()));
		return OrganizationUnitResponse.leaf(saved, directUserCount(saved.getId()));
	}

	@Transactional(readOnly = true)
	public OrganizationUnit requireEnabledUnit(UUID unitId) {
		return organizationUnitRepository.findByIdAndStatus(unitId, OrganizationUnitStatus.ENABLED)
				.orElseThrow(() -> new DomainException(
						HttpStatus.CONFLICT,
						"ORGANIZATION_UNAVAILABLE",
						"所选组织已停用或不存在。",
						List.of(new ApiProblem.FieldProblem("organizationUnitId", "请选择启用的组织或部门。"))));
	}

	@Transactional(readOnly = true)
	public Set<UUID> withDescendants(UUID unitId) {
		requireUnit(unitId);
		Map<UUID, List<OrganizationUnit>> childrenByParent = new HashMap<>();
		for (OrganizationUnit unit : organizationUnitRepository.findAll()) {
			if (unit.getParent() != null) {
				childrenByParent.computeIfAbsent(unit.getParent().getId(), ignored -> new ArrayList<>()).add(unit);
			}
		}
		Set<UUID> ids = new HashSet<>();
		collectDescendants(unitId, childrenByParent, ids);
		return ids;
	}

	private void collectDescendants(
			UUID unitId,
			Map<UUID, List<OrganizationUnit>> childrenByParent,
			Set<UUID> collected) {
		if (!collected.add(unitId)) {
			return;
		}
		for (OrganizationUnit child : childrenByParent.getOrDefault(unitId, List.of())) {
			collectDescendants(child.getId(), childrenByParent, collected);
		}
	}

	private OrganizationUnitResponse toTreeResponse(
			OrganizationUnit unit,
			Map<UUID, List<OrganizationUnit>> childrenByParent,
			Map<UUID, Long> accountCounts) {
		List<OrganizationUnitResponse> children = childrenByParent.getOrDefault(unit.getId(), List.of()).stream()
				.map(child -> toTreeResponse(child, childrenByParent, accountCounts))
				.toList();
		return new OrganizationUnitResponse(
				unit.getId(),
				unit.getParent() == null ? null : unit.getParent().getId(),
				unit.getName(),
				unit.getCode(),
				unit.getUnitType(),
				unit.getStatus(),
				unit.getManagerAccountId(),
				unit.getSortOrder(),
				unit.getVersion(),
				accountCounts.getOrDefault(unit.getId(), 0L),
				children);
	}

	private OrganizationUnit resolveParent(
			OrganizationUnitType unitType,
			UUID parentId,
			OrganizationUnit currentUnit) {
		if (unitType == OrganizationUnitType.COMPANY) {
			if (parentId != null) {
				throw validation("parentId", "公司节点不能指定上级部门。");
			}
			return null;
		}
		if (parentId == null) {
			throw validation("parentId", "部门必须选择上级组织。" );
		}
		OrganizationUnit parent = requireEnabledUnit(parentId);
		if (currentUnit != null && wouldCreateCycle(currentUnit, parent)) {
			throw conflict("ORGANIZATION_CYCLE", "上级部门不能是当前节点或其下级节点。", "parentId");
		}
		return parent;
	}

	private boolean wouldCreateCycle(OrganizationUnit currentUnit, OrganizationUnit candidateParent) {
		OrganizationUnit cursor = candidateParent;
		while (cursor != null) {
			if (cursor.getId().equals(currentUnit.getId())) {
				return true;
			}
			cursor = cursor.getParent();
		}
		return false;
	}

	private void validateNameAndCode(
			String name,
			String code,
			OrganizationUnit parent,
			OrganizationUnit currentUnit) {
		if (!StringUtils.hasText(name)) {
			throw validation("name", "请输入部门名称。" );
		}
		if (!StringUtils.hasText(code)) {
			throw validation("code", "请输入部门编码。" );
		}
		String normalizedCode = normalizeCode(code);
		Collection<OrganizationUnit> allUnits = organizationUnitRepository.findAll();
		boolean duplicateName = allUnits.stream().anyMatch(unit -> unit != currentUnit
				&& sameParent(unit.getParent(), parent)
				&& unit.getName().equalsIgnoreCase(name.trim()));
		if (duplicateName) {
			throw conflict("DUPLICATE_ORGANIZATION_NAME", "同一上级下已存在该名称。", "name");
		}
		boolean duplicateCode = allUnits.stream().anyMatch(unit -> unit != currentUnit
				&& unit.getCode().equalsIgnoreCase(normalizedCode));
		if (duplicateCode) {
			throw conflict("DUPLICATE_ORGANIZATION_CODE", "部门编码已存在。", "code");
		}
	}

	private boolean sameParent(OrganizationUnit first, OrganizationUnit second) {
		if (first == null || second == null) {
			return first == second;
		}
		return first.getId().equals(second.getId());
	}

	private OrganizationUnit requireUnit(UUID unitId) {
		return organizationUnitRepository.findById(unitId)
				.orElseThrow(() -> new DomainException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "未找到该组织节点。"));
	}

	private long directUserCount(UUID unitId) {
		return userAccountRepository.countByOrganizationUnitIdAndAccountStatus(unitId, AccountStatus.ENABLED);
	}

	private void validateVersion(long actualVersion, long expectedVersion) {
		if (actualVersion != expectedVersion) {
			throw new DomainException(HttpStatus.CONFLICT, "VERSION_CONFLICT", "数据已被其他操作更新，请刷新后重试。" );
		}
	}

	private String normalizeCode(String code) {
		return code.trim().toUpperCase(java.util.Locale.ROOT);
	}

	private DomainException validation(String field, String message) {
		return new DomainException(
				HttpStatus.BAD_REQUEST,
				"VALIDATION_FAILED",
				"请检查输入后重试。",
				List.of(new ApiProblem.FieldProblem(field, message)));
	}

	private DomainException conflict(String code, String message, String field) {
		return new DomainException(
				HttpStatus.CONFLICT,
				code,
				message,
				List.of(new ApiProblem.FieldProblem(field, message)));
	}
}
