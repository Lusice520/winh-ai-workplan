package com.winh.workplan.iam.authorization;

import java.util.List;

public record AuthorizationDecision(
		boolean allowed,
		String reasonCode,
		List<String> explanation) {

	public static AuthorizationDecision allow(String reasonCode, List<String> explanation) {
		return new AuthorizationDecision(true, reasonCode, List.copyOf(explanation));
	}

	public static AuthorizationDecision deny(String reasonCode, String explanation) {
		return new AuthorizationDecision(false, reasonCode, List.of(explanation));
	}
}
