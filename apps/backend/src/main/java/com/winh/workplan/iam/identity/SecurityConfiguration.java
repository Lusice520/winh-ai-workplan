package com.winh.workplan.iam.identity;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

@Configuration
@EnableWebSecurity
class SecurityConfiguration {

	@Bean
	SessionAuthenticationFilter sessionAuthenticationFilter(
			IdentitySessionService identitySessionService,
			SessionCookieWriter sessionCookieWriter,
			ObjectMapper objectMapper) {
		return new SessionAuthenticationFilter(identitySessionService, sessionCookieWriter, objectMapper);
	}

	@Bean
	AccessControlAuthorizationFilter accessControlAuthorizationFilter(
			com.winh.workplan.iam.authorization.AuthorizationService authorizationService,
			com.winh.workplan.iam.audit.AuditRecorder auditRecorder,
			ObjectMapper objectMapper) {
		return new AccessControlAuthorizationFilter(authorizationService, auditRecorder, objectMapper);
	}

	@Bean
	SecurityFilterChain securityFilterChain(
			HttpSecurity http,
			SessionAuthenticationFilter sessionAuthenticationFilter,
			AccessControlAuthorizationFilter accessControlAuthorizationFilter,
			ApiAuthenticationEntryPoint apiAuthenticationEntryPoint,
			ApiAccessDeniedHandler apiAccessDeniedHandler) throws Exception {
		CookieCsrfTokenRepository csrfTokenRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
		csrfTokenRepository.setCookiePath("/");

		http
				.csrf(csrf -> csrf.csrfTokenRepository(csrfTokenRepository))
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.formLogin(AbstractHttpConfigurer::disable)
				.httpBasic(AbstractHttpConfigurer::disable)
				.logout(AbstractHttpConfigurer::disable)
				.exceptionHandling(exceptions -> exceptions
						.authenticationEntryPoint(apiAuthenticationEntryPoint)
						.accessDeniedHandler(apiAccessDeniedHandler))
				.authorizeHttpRequests(authorize -> authorize
						.requestMatchers("/actuator/health", "/api/system/status", "/api/auth/csrf").permitAll()
						.requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/logout").permitAll()
						.requestMatchers("/api/iam/**", "/api/access-control/**").authenticated()
						.anyRequest().authenticated())
				.addFilterBefore(sessionAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
				.addFilterAfter(accessControlAuthorizationFilter, SessionAuthenticationFilter.class);

		return http.build();
	}
}
