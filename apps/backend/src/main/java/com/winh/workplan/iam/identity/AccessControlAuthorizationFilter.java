package com.winh.workplan.iam.identity;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.winh.workplan.iam.authorization.AccessControlPermissions;
import com.winh.workplan.iam.authorization.AuthorizationDecision;
import com.winh.workplan.iam.authorization.AuthorizationService;
import com.winh.workplan.iam.authorization.ResourceContext;
import com.winh.workplan.iam.audit.AuditEventCommand;
import com.winh.workplan.iam.audit.AuditOutcome;
import com.winh.workplan.iam.audit.AuditRecorder;
import com.winh.workplan.iam.shared.ApiProblem;
import com.winh.workplan.iam.shared.CorrelationIdHolder;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Converts a protected HTTP operation into one centrally registered permission
 * item. Controllers stay HTTP adapters; neither they nor the SPA can make an
 * independent allow decision.
 */
class AccessControlAuthorizationFilter extends OncePerRequestFilter {

	private final AuthorizationService authorizationService;
	private final AuditRecorder auditRecorder;
	private final ObjectMapper objectMapper;

	AccessControlAuthorizationFilter(
			AuthorizationService authorizationService,
			AuditRecorder auditRecorder,
			ObjectMapper objectMapper) {
		this.authorizationService = authorizationService;
		this.auditRecorder = auditRecorder;
		this.objectMapper = objectMapper;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		String path = request.getRequestURI();
		return !path.startsWith("/api/iam/") && !path.startsWith("/api/access-control/");
	}

	@Override
	protected void doFilterInternal(
			HttpServletRequest request,
			HttpServletResponse response,
			FilterChain filterChain) throws ServletException, IOException {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !(authentication.getPrincipal() instanceof SessionPrincipal principal)) {
			filterChain.doFilter(request, response);
			return;
		}
		if (isNavigationRequest(request)) {
			filterChain.doFilter(request, response);
			return;
		}

		Optional<String> permission = permissionFor(request);
		if (permission.isEmpty()) {
			deny(response, principal, request, "UNREGISTERED_MANAGED_ENDPOINT", null);
			return;
		}
		AuthorizationDecision decision = authorizationService.decide(
				principal, permission.get(), ResourceContext.empty());
		if (!decision.allowed()) {
			deny(response, principal, request, decision.reasonCode(), permission.get());
			return;
		}
		filterChain.doFilter(request, response);
	}

	private Optional<String> permissionFor(HttpServletRequest request) {
		String path = request.getRequestURI();
		String method = request.getMethod();
		if (path.startsWith("/api/iam/organization-units")) {
			return Optional.of(HttpMethod.GET.matches(method)
					? AccessControlPermissions.IAM_ORGANIZATION_READ
					: AccessControlPermissions.IAM_ORGANIZATION_MANAGE);
		}
		if (path.startsWith("/api/iam/users")) {
			return Optional.of(HttpMethod.GET.matches(method)
					? AccessControlPermissions.IAM_USER_READ
					: AccessControlPermissions.IAM_USER_MANAGE);
		}
		if (path.startsWith("/api/access-control/menu-resources")) {
			return Optional.of(HttpMethod.GET.matches(method)
					? AccessControlPermissions.IAM_MENU_RESOURCE_READ
					: AccessControlPermissions.IAM_MENU_RESOURCE_MANAGE);
		}
		if (path.startsWith("/api/access-control/permission-items")) {
			return HttpMethod.GET.matches(method)
					? Optional.of(AccessControlPermissions.IAM_PERMISSION_ITEM_READ)
					: Optional.empty();
		}
		if (path.startsWith("/api/access-control/roles")) {
			return Optional.of(HttpMethod.GET.matches(method)
					? AccessControlPermissions.IAM_ROLE_READ
					: AccessControlPermissions.IAM_ROLE_MANAGE);
		}
		if (path.startsWith("/api/access-control/system-role-assignments")
				|| path.matches("/api/access-control/accounts/[^/]+/system-role-assignments")) {
			return Optional.of(HttpMethod.GET.matches(method)
					? AccessControlPermissions.IAM_SYSTEM_ROLE_ASSIGNMENT_READ
					: AccessControlPermissions.IAM_SYSTEM_ROLE_ASSIGNMENT_MANAGE);
		}
		if (path.startsWith("/api/access-control/temporary-grants")) {
			if(HttpMethod.POST.matches(method)&&path.matches("/api/access-control/temporary-grants/[^/]+/review"))
				return Optional.of(AccessControlPermissions.IAM_TEMPORARY_GRANT_REVIEW);
			return Optional.of(HttpMethod.GET.matches(method)
					? AccessControlPermissions.IAM_TEMPORARY_GRANT_READ
					: AccessControlPermissions.IAM_TEMPORARY_GRANT_MANAGE);
		}
		if (path.equals("/api/access-control/permission-preview") && HttpMethod.POST.matches(method)) {
			return Optional.of(AccessControlPermissions.IAM_PERMISSION_PREVIEW);
		}
		return Optional.empty();
	}

	private boolean isNavigationRequest(HttpServletRequest request) {
		return (request.getRequestURI().equals("/api/access-control/navigation")
				|| request.getRequestURI().equals("/api/access-control/capabilities"))
				&& HttpMethod.GET.matches(request.getMethod());
	}

	private void deny(
			HttpServletResponse response,
			SessionPrincipal principal,
			HttpServletRequest request,
			String reason,
			String permission) throws IOException {
		auditRecorder.record(new AuditEventCommand(
				"AUTHORIZATION_HTTP_DENIED",
				principal.accountId(),
				"HTTP_ENDPOINT",
				null,
				AuditOutcome.DENIED,
				CorrelationIdHolder.currentOrCreate(),
				reason,
				null,
				"method=" + request.getMethod() + ";permission="
						+ (permission == null ? "UNREGISTERED" : permission)));
		response.setStatus(HttpServletResponse.SC_FORBIDDEN);
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		objectMapper.writeValue(response.getOutputStream(), new ApiProblem(
				"ACCESS_DENIED",
				"当前账号没有执行该操作的权限。",
				List.of(),
				CorrelationIdHolder.currentOrCreate()));
	}
}
