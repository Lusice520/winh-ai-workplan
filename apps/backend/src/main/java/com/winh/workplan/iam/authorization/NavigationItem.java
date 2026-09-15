package com.winh.workplan.iam.authorization;

import java.util.List;

public record NavigationItem(
		String code,
		String name,
		String routeKey,
		String iconKey,
		List<NavigationItem> children) {

	public NavigationItem {
		children = List.copyOf(children);
	}
}
