CREATE TABLE delivery_responsibility_transfer (
  id UUID PRIMARY KEY,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  case_id UUID NOT NULL REFERENCES delivery_case(id),
  from_id UUID NOT NULL REFERENCES user_account(id),
  to_id UUID NOT NULL REFERENCES user_account(id),
  mapping_json TEXT NOT NULL,
  mapping_hash VARCHAR(64) NOT NULL,
  permissions_json TEXT NOT NULL,
  signatures_json TEXT NOT NULL,
  status VARCHAR(24) NOT NULL CHECK(status IN ('PENDING','ACCEPTED','APPLIED','RETURNED','CANCELLED')),
  basis VARCHAR(2000) NOT NULL,
  submitted_by UUID NOT NULL REFERENCES user_account(id),
  accepted_by UUID REFERENCES user_account(id),
  accepted_at TIMESTAMP WITH TIME ZONE,
  acceptance_note VARCHAR(4000),
  decided_by UUID REFERENCES user_account(id),
  effective_at TIMESTAMP WITH TIME ZONE,
  decision_note VARCHAR(4000),
  CHECK(from_id <> to_id)
);
CREATE INDEX ix_delivery_transfer_case ON delivery_responsibility_transfer(case_id,created_at DESC);
CREATE UNIQUE INDEX uq_delivery_transfer_open_person ON delivery_responsibility_transfer(case_id,from_id)
  WHERE status IN ('PENDING','ACCEPTED');
