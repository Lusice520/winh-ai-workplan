package com.winh.workplan.execution;

import com.winh.workplan.iam.identity.SessionPrincipal;
import java.time.LocalDate;
import java.util.UUID;

/** Read-only execution facts for tasks, time records and other project modules. */
public interface ExecutionDirectory {
    StageState stage(SessionPrincipal actor, UUID projectId, UUID stageId);
    record StageState(String status, LocalDate startedOn) {}
}
