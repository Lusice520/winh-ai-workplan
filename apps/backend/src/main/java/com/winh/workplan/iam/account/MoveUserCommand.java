package com.winh.workplan.iam.account;

import java.util.UUID;

public record MoveUserCommand(UUID targetOrganizationUnitId, String reason, long version) {
}
