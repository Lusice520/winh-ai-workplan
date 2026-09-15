package com.winh.workplan.iam.identity;

import java.io.IOException;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.winh.workplan.iam.shared.ApiProblem;
import com.winh.workplan.iam.shared.CorrelationIdHolder;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

class SessionAuthenticationFilter extends OncePerRequestFilter {

	private final IdentitySessionService identitySessionService;
	private final SessionCookieWriter sessionCookieWriter;
	private final ObjectMapper objectMapper;

	SessionAuthenticationFilter(
			IdentitySessionService identitySessionService,
			SessionCookieWriter sessionCookieWriter,
			ObjectMapper objectMapper) {
		this.identitySessionService = identitySessionService;
		this.sessionCookieWriter = sessionCookieWriter;
		this.objectMapper = objectMapper;
	}

	@Override
	protected void doFilterInternal(
			HttpServletRequest request,
			HttpServletResponse response,
			FilterChain filterChain) throws ServletException, IOException {
		if (SecurityContextHolder.getContext().getAuthentication() == null) {
			identitySessionService.resolve(sessionCookieWriter.read(request)).ifPresent(principal -> {
				SecurityContextHolder.getContext().setAuthentication(
						new UsernamePasswordAuthenticationToken(principal, null, List.of()));
			});
		}

		Object principal = SecurityContextHolder.getContext().getAuthentication() == null
				? null
				: SecurityContextHolder.getContext().getAuthentication().getPrincipal();
		if (principal instanceof SessionPrincipal sessionPrincipal
				&& sessionPrincipal.mustChangePassword()
				&& request.getRequestURI().startsWith("/api/")
				&& !request.getRequestURI().startsWith("/api/auth/")
				&& !request.getRequestURI().equals("/api/system/status")) {
			response.setStatus(HttpServletResponse.SC_FORBIDDEN);
			response.setContentType(MediaType.APPLICATION_JSON_VALUE);
			objectMapper.writeValue(response.getOutputStream(), new ApiProblem(
					"PASSWORD_CHANGE_REQUIRED",
					"请先修改临时密码后再继续。",
					List.of(),
					CorrelationIdHolder.currentOrCreate()));
			return;
		}

		filterChain.doFilter(request, response);
	}
}
