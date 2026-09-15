package com.winh.workplan.iam.identity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface AccountSessionRepository extends JpaRepository<AccountSession, UUID> {

	Optional<AccountSession> findByTokenHash(String tokenHash);

	List<AccountSession> findByAccountIdAndRevokedAtIsNull(UUID accountId);
}
