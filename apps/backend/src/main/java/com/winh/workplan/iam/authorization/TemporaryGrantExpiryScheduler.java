package com.winh.workplan.iam.authorization;

import java.time.Instant;

import com.winh.workplan.iam.audit.AuditEventCommand;
import com.winh.workplan.iam.audit.AuditOutcome;
import com.winh.workplan.iam.audit.AuditRecorder;
import com.winh.workplan.iam.shared.CorrelationIdHolder;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class TemporaryGrantExpiryScheduler {

	private final TemporaryGrantRepository temporaryGrantRepository;
	private final AuditRecorder auditRecorder;

	TemporaryGrantExpiryScheduler(
			TemporaryGrantRepository temporaryGrantRepository,
			AuditRecorder auditRecorder) {
		this.temporaryGrantRepository = temporaryGrantRepository;
		this.auditRecorder = auditRecorder;
	}

	@Scheduled(fixedDelayString = "${app.access-control.temporary-grant-expiry-check-ms:60000}")
	@Transactional
	void expireElapsedGrants() {
		Instant now = Instant.now();
		java.util.stream.Stream.of(TemporaryGrantStatus.ACTIVE,TemporaryGrantStatus.PENDING_REVIEW)
				.flatMap(status -> temporaryGrantRepository.findAllByStatusAndEndsAtLessThanEqual(status,now).stream())
				.forEach(grant -> {
					grant.expire();
					auditRecorder.record(new AuditEventCommand(
							"TEMPORARY_GRANT_EXPIRED",
							null,
							"TEMPORARY_GRANT",
							grant.getId(),
							AuditOutcome.SUCCEEDED,
							CorrelationIdHolder.currentOrCreate(),
							"授权到期自动失效。",
							null,
							"EXPIRED"));
				});
	}
}
