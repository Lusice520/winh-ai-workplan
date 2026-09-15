package com.winh.workplan.iam.authorization;

import java.util.List;

import com.winh.workplan.iam.identity.SessionPrincipal;

public interface AuthorizationService {

	AuthorizationDecision decide(
			SessionPrincipal subject,
			String permissionCode,
			ResourceContext resourceContext);

	List<NavigationItem> listNavigation(SessionPrincipal subject);
}
