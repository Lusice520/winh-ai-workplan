package com.winh.workplan.iam.shared;

import java.io.IOException;
import java.util.UUID;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class CorrelationIdFilter extends OncePerRequestFilter {

	public static final String HEADER_NAME = "X-Correlation-Id";

	@Override
	protected void doFilterInternal(
			HttpServletRequest request,
			HttpServletResponse response,
			FilterChain filterChain) throws ServletException, IOException {
		String requestedId = request.getHeader(HEADER_NAME);
		String correlationId = requestedId == null || requestedId.isBlank()
				? UUID.randomUUID().toString()
				: requestedId.trim();

		CorrelationIdHolder.set(correlationId);
		response.setHeader(HEADER_NAME, correlationId);
		try {
			filterChain.doFilter(request, response);
		} finally {
			CorrelationIdHolder.clear();
		}
	}
}
