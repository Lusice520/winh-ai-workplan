package com.winh.workplan.system;

import java.time.Instant;

public record SystemStatusResponse(
		String status,
		String service,
		String version,
		Instant timestamp) {
}
