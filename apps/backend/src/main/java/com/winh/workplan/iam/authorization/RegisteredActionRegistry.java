package com.winh.workplan.iam.authorization;

import java.util.Set;

/**
 * Action keys are opaque, shipping contracts. They are deliberately not URLs
 * and cannot be invented from a browser request.
 */
public final class RegisteredActionRegistry {

	private static final Set<String> ACTION_KEYS = Set.of(
			"iam.organization-user.manage",
			"iam.access-control.manage",
			"delivery.template.manage",
			"delivery.policy.manage",
			"delivery.policy.publish");

	private RegisteredActionRegistry() {
	}

	public static boolean contains(String actionKey) {
		return ACTION_KEYS.contains(actionKey);
	}
}
