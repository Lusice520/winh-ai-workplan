package com.winh.workplan.iam.identity;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
class SessionCookieWriter {

	private final SessionProperties sessionProperties;

	SessionCookieWriter(SessionProperties sessionProperties) {
		this.sessionProperties = sessionProperties;
	}

	void write(HttpServletResponse response, String rawToken) {
		ResponseCookie cookie = ResponseCookie.from(sessionProperties.getCookieName(), rawToken)
				.httpOnly(true)
				.secure(sessionProperties.isCookieSecure())
				.sameSite("Lax")
				.path("/")
				.maxAge(java.time.Duration.ofHours(sessionProperties.getAbsoluteHours()))
				.build();
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

	void clear(HttpServletResponse response) {
		ResponseCookie cookie = ResponseCookie.from(sessionProperties.getCookieName(), "")
				.httpOnly(true)
				.secure(sessionProperties.isCookieSecure())
				.sameSite("Lax")
				.path("/")
				.maxAge(java.time.Duration.ZERO)
				.build();
		response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
	}

	String read(HttpServletRequest request) {
		Cookie[] cookies = request.getCookies();
		if (cookies == null) {
			return null;
		}
		for (Cookie cookie : cookies) {
			if (sessionProperties.getCookieName().equals(cookie.getName())) {
				return cookie.getValue();
			}
		}
		return null;
	}
}
