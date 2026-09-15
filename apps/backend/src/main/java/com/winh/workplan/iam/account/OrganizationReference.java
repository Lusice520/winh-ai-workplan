package com.winh.workplan.iam.account;

import java.util.UUID;

public record OrganizationReference(UUID id, String name, String code) {
}
