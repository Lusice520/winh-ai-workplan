package com.winh.workplan.iam.account;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface AccountOrganizationHistoryRepository extends JpaRepository<AccountOrganizationHistory, UUID> {
}
