package com.winh.workplan.iam.authorization;

import com.winh.workplan.business.BusinessRules;
import com.winh.workplan.iam.identity.SessionPrincipal;
import com.winh.workplan.iam.shared.DomainException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class DefaultProjectRoleAssignments implements ProjectRoleAssignments {
    private final ProjectRoleAssignmentRepository assignments;
    private final AccessRoleRepository roles;
    private final RolePermissionGrantRepository grants;
    private final AuthorizationService authorization;
    DefaultProjectRoleAssignments(ProjectRoleAssignmentRepository assignments, AccessRoleRepository roles,
            RolePermissionGrantRepository grants, AuthorizationService authorization) {
        this.assignments = assignments; this.roles = roles; this.grants = grants; this.authorization = authorization;
    }
    @Override @Transactional
    public void initializeOwners(UUID projectId, UUID salesOwner, UUID presalesOwner, UUID actor) {
        assign(projectId, salesOwner, List.of("PROJECT_OWNER"), actor);
        if (!salesOwner.equals(presalesOwner)) assign(projectId, presalesOwner, List.of("PROJECT_OWNER"), actor);
    }
    @Override @Transactional
    public void replace(SessionPrincipal actor, ResourceContext context, UUID accountId, List<String> roleCodes) {
        validateReplacement(actor,context,roleCodes);
        assign(context.projectId(), accountId, roleCodes, actor.accountId());
    }
    @Override @Transactional(readOnly=true)
    public void validateReplacement(SessionPrincipal actor,ResourceContext context,List<String> roleCodes){
        if (!authorization.decide(actor, "PROJECT_MEMBER_MANAGE", context).allowed())
            throw new DomainException(HttpStatus.FORBIDDEN, "ACCESS_DENIED", "没有项目成员管理权限。");
        if (context.projectId() == null || roleCodes == null || roleCodes.size() > 3 || roleCodes.stream().anyMatch(java.util.Objects::isNull)
                || !Set.of("PROJECT_OWNER", "PROJECT_CONTRIBUTOR", "PROJECT_REVIEWER").containsAll(roleCodes))
            throw BusinessRules.invalid("roleCodes", "请选择已注册的项目角色。");
        for (String code : roleCodes) {
            var role = requireRole(code);
            if (grants.findAllByRoleIdOrderByPermissionItemCodeAsc(role.getId()).stream()
                    .anyMatch(grant -> !authorization.decide(actor, grant.getPermissionItem().getCode(), context).allowed()))
                throw new DomainException(HttpStatus.FORBIDDEN, "AUTHORIZATION_SCOPE_EXCEEDED", "不能下放自己不具备的项目权限。");
        }
    }
    private AccessRole requireRole(String code) {
        return roles.findByCode(code).filter(r -> r.getRoleType() == AccessRoleType.PROJECT
            && r.getStatus() == AccessRoleStatus.ENABLED).orElseThrow(() -> BusinessRules.conflict("项目角色尚未配置或已停用。"));
    }
    private void assign(UUID projectId, UUID accountId, List<String> codes, UUID actor) {
        var existing = assignments.findAllByAccountIdAndProjectId(accountId, projectId);
        existing.forEach(a -> { a.active = codes.contains(a.role.getCode()); a.assignedBy = actor; a.touch(); });
        for (String code : codes) {
            if (existing.stream().noneMatch(a -> a.role.getCode().equals(code)))
                assignments.save(new ProjectRoleAssignment(projectId, accountId, requireRole(code), actor));
        }
    }
}
