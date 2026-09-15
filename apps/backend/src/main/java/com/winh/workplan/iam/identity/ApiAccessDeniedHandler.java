package com.winh.workplan.iam.identity;

import java.io.IOException;
import java.util.List;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.winh.workplan.iam.shared.ApiProblem;
import com.winh.workplan.iam.shared.CorrelationIdHolder;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.stereotype.Component;

@Component
class ApiAccessDeniedHandler implements AccessDeniedHandler {

	private final ObjectMapper objectMapper;

	ApiAccessDeniedHandler(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	public void handle(
			HttpServletRequest request,
			HttpServletResponse response,
			AccessDeniedException accessDeniedException) throws IOException {
		boolean csrfValidationFailed = accessDeniedException instanceof CsrfException;
		response.setStatus(HttpServletResponse.SC_FORBIDDEN);
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		objectMapper.writeValue(response.getOutputStream(), new ApiProblem(
				csrfValidationFailed ? "CSRF_VALIDATION_FAILED" : "ACCESS_DENIED",
				csrfValidationFailed ? "请求校验已失效，请再次提交；如仍失败，请刷新页面后重试。" : "当前账号没有执行该操作的权限。",
				List.of(),
				CorrelationIdHolder.currentOrCreate()));
	}
}
