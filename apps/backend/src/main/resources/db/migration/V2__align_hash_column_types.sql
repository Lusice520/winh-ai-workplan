-- Keep the schema contract aligned with the JPA mappings.  These values are
-- fixed-length SHA-256 digests, but VARCHAR avoids PostgreSQL CHAR padding
-- and allows Hibernate's strict schema validation to remain enabled.
ALTER TABLE account_session
    ALTER COLUMN token_hash TYPE VARCHAR(64)
    USING token_hash::VARCHAR(64);

ALTER TABLE idempotency_record
    ALTER COLUMN request_hash TYPE VARCHAR(64)
    USING request_hash::VARCHAR(64);
