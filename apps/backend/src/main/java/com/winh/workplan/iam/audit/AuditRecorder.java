package com.winh.workplan.iam.audit;

public interface AuditRecorder {

	void record(AuditEventCommand command);
}
