package com.winh.workplan.iam.audit;

import org.springframework.stereotype.Service;

@Service
class DatabaseAuditRecorder implements AuditRecorder {

	private final AuditEventRepository auditEventRepository;

	DatabaseAuditRecorder(AuditEventRepository auditEventRepository) {
		this.auditEventRepository = auditEventRepository;
	}

	@Override
	public void record(AuditEventCommand command) {
		auditEventRepository.save(new AuditEvent(command));
	}
}
