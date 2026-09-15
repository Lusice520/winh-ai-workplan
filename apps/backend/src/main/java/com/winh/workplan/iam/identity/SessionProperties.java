package com.winh.workplan.iam.identity;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.session")
public class SessionProperties {

	private String cookieName = "WINH_SESSION";
	private boolean cookieSecure;
	private int absoluteHours = 8;
	private int idleMinutes = 30;
	private int failedLoginLimit = 5;
	private int lockMinutes = 15;

	public String getCookieName() {
		return cookieName;
	}

	public void setCookieName(String cookieName) {
		this.cookieName = cookieName;
	}

	public boolean isCookieSecure() {
		return cookieSecure;
	}

	public void setCookieSecure(boolean cookieSecure) {
		this.cookieSecure = cookieSecure;
	}

	public int getAbsoluteHours() {
		return absoluteHours;
	}

	public void setAbsoluteHours(int absoluteHours) {
		this.absoluteHours = absoluteHours;
	}

	public int getIdleMinutes() {
		return idleMinutes;
	}

	public void setIdleMinutes(int idleMinutes) {
		this.idleMinutes = idleMinutes;
	}

	public int getFailedLoginLimit() {
		return failedLoginLimit;
	}

	public void setFailedLoginLimit(int failedLoginLimit) {
		this.failedLoginLimit = failedLoginLimit;
	}

	public int getLockMinutes() {
		return lockMinutes;
	}

	public void setLockMinutes(int lockMinutes) {
		this.lockMinutes = lockMinutes;
	}
}
