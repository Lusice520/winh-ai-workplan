package com.winh.workplan.iam.authorization;

import java.util.Set;

/**
 * Database rows may select only route keys that the shipping web router knows.
 * This is a registry of opaque keys, not a navigation fallback or arbitrary
 * URL allow-list.
 */
public final class RegisteredNavigationRegistry {

	private static final Set<String> ROUTE_KEYS = Set.of(
			"crm.customers", "crm.opportunities", "business.projects", "business.presales", "business.requirements", "business.contracts",
			"business.delivery-initiation",
			"system.overview",
			"system.delivery-configuration",
			"system.organization-users",
			"system.access-control");

	private RegisteredNavigationRegistry() {
	}

	public static boolean contains(String routeKey) {
		return ROUTE_KEYS.contains(routeKey);
	}
}
