package com.winh.workplan.iam.shared;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class IdempotencyService {

	private final IdempotencyRecordRepository repository;

	IdempotencyService(IdempotencyRecordRepository repository) {
		this.repository = repository;
	}

	public IdempotencyReservation reserve(String scope, String idempotencyKey, String requestFingerprint) {
		String requestHash = hash(requestFingerprint);
		return repository.findByOperationScopeAndIdempotencyKey(scope, idempotencyKey)
				.map(existing -> replayOrReject(existing, requestHash))
				.orElseGet(() -> newReservation(scope, idempotencyKey, requestHash));
	}

	public void complete(IdempotencyReservation reservation, UUID targetId) {
		if (!reservation.replayed()) {
			reservation.record.complete(targetId);
		}
	}

	private IdempotencyReservation replayOrReject(IdempotencyRecord existing, String requestHash) {
		if (!existing.getRequestHash().equals(requestHash)) {
			throw new DomainException(
					HttpStatus.CONFLICT,
					"IDEMPOTENCY_CONFLICT",
					"同一幂等键不能用于不同请求。",
					java.util.List.of());
		}
		return new IdempotencyReservation(true, existing.getTargetId(), existing);
	}

	private IdempotencyReservation newReservation(String scope, String idempotencyKey, String requestHash) {
		IdempotencyRecord record = repository.save(new IdempotencyRecord(scope, idempotencyKey, requestHash));
		return new IdempotencyReservation(false, null, record);
	}

	private String hash(String source) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
					.digest(source.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("当前 JDK 不支持 SHA-256。", exception);
		}
	}

	public static final class IdempotencyReservation {

		private final boolean replayed;
		private final UUID targetId;
		private final IdempotencyRecord record;

		private IdempotencyReservation(boolean replayed, UUID targetId, IdempotencyRecord record) {
			this.replayed = replayed;
			this.targetId = targetId;
			this.record = record;
		}

		public boolean replayed() {
			return replayed;
		}

		public UUID targetId() {
			return targetId;
		}
	}
}
