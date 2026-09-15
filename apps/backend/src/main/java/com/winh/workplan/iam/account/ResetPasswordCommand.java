package com.winh.workplan.iam.account;

public record ResetPasswordCommand(String temporaryPassword, String reason, long version) {
}
