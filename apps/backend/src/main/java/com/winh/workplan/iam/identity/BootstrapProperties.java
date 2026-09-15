package com.winh.workplan.iam.identity;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.bootstrap")
public class BootstrapProperties {

	private boolean enabled = true;
	private String adminLogin = "admin";
	private String adminPassword = "";
	private String adminDisplayName = "本地管理员";
	private String organizationName = "本地示例组织";

	public boolean isEnabled() {
		return enabled;
	}

	public void setEnabled(boolean enabled) {
		this.enabled = enabled;
	}

	public String getAdminLogin() {
		return adminLogin;
	}

	public void setAdminLogin(String adminLogin) {
		this.adminLogin = adminLogin;
	}

	public String getAdminPassword() {
		return adminPassword;
	}

	public void setAdminPassword(String adminPassword) {
		this.adminPassword = adminPassword;
	}

	public String getAdminDisplayName() {
		return adminDisplayName;
	}

	public void setAdminDisplayName(String adminDisplayName) {
		this.adminDisplayName = adminDisplayName;
	}

	public String getOrganizationName() {
		return organizationName;
	}

	public void setOrganizationName(String organizationName) {
		this.organizationName = organizationName;
	}
}
