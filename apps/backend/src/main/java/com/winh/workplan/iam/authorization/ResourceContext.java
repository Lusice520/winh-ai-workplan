package com.winh.workplan.iam.authorization;

import java.util.UUID;

/**
 * The business module supplies only the stable facts that the central policy
 * needs. Missing required context defaults to a denial rather than a broad
 * authorization assumption.
 */
public record ResourceContext(
		UUID subjectAccountId,
		UUID organizationUnitId,
		UUID projectId,
		String objectReference,
		boolean participatingProject,
		boolean resourceEnabled,
		boolean recordStateAllowed,
		boolean sensitiveConditionsMet) {

	public static ResourceContext empty() {
		return new ResourceContext(null, null, null, null, false, true, true, true);
	}
}
