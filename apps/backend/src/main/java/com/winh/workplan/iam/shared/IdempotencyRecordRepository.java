package com.winh.workplan.iam.shared;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, UUID> {

	Optional<IdempotencyRecord> findByOperationScopeAndIdempotencyKey(String operationScope, String idempotencyKey);
}
