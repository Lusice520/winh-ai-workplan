package com.winh.workplan.system;

import java.time.Clock;
import java.time.Instant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system")
public class SystemStatusController {

	private final String applicationName;
	private final String applicationVersion;
	private final Clock clock;

	public SystemStatusController(
			@Value("${spring.application.name}") String applicationName,
			@Value("${app.version}") String applicationVersion) {
		this.applicationName = applicationName;
		this.applicationVersion = applicationVersion;
		this.clock = Clock.systemUTC();
	}

	@GetMapping("/status")
	public SystemStatusResponse status() {
		return new SystemStatusResponse(
				"UP",
				applicationName,
				applicationVersion,
				Instant.now(clock));
	}
}
