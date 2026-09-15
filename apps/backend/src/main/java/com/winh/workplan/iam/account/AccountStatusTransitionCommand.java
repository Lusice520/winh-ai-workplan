package com.winh.workplan.iam.account;

public record AccountStatusTransitionCommand(AccountStatus targetStatus, String reason, long version) {
}
