package com.winh.workplan.iam.authorization;

import java.util.List;
import java.util.UUID;
import com.winh.workplan.iam.identity.SessionPrincipal;

/** The project module owns membership; IAM owns the corresponding scoped grants. */
public interface ProjectRoleAssignments {
    void initializeOwners(UUID projectId, UUID salesOwner, UUID presalesOwner, UUID actor);
    void replace(SessionPrincipal actor, ResourceContext context, UUID accountId, List<String> roleCodes);
    void validateReplacement(SessionPrincipal actor, ResourceContext context, List<String> roleCodes);
}
