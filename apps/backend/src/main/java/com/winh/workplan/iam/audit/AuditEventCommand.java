package com.winh.workplan.iam.audit;

import java.util.UUID;

public record AuditEventCommand(
		String eventType,
		UUID actorAccountId,
		String subjectType,
		UUID subjectId,
		AuditOutcome outcome,
		String correlationId,
		String reason,
		String beforeSummary,
		String afterSummary) {
}
