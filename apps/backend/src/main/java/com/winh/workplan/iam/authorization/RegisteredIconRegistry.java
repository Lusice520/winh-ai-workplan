package com.winh.workplan.iam.authorization;

import java.util.Set;

/**
 * The server stores an icon key rather than a client-controlled icon payload.
 * The web application maps these keys to its own icon components.
 */
public final class RegisteredIconRegistry {

	private static final Set<String> ICON_KEYS = Set.of(
			"settings",
			"gauge",
			"users",
			"shield-check",
			"users-cog",
			"shield-cog",
			"folder",
			"file",
			"key-round",
			"lock-keyhole",
			"list-tree",
			"database",
			"workflow",
			"layers");

	private RegisteredIconRegistry() {
	}

	public static boolean contains(String iconKey) {
		return ICON_KEYS.contains(iconKey);
	}
}
