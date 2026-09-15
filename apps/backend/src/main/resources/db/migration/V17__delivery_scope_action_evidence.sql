CREATE TABLE delivery_scope_event (
    id uuid PRIMARY KEY, version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
    change_id uuid NOT NULL REFERENCES delivery_scope_change(id),
    action varchar(32) NOT NULL, actor_id uuid NOT NULL REFERENCES user_account(id),
    note varchar(4000) NOT NULL
);
CREATE INDEX ix_delivery_scope_event ON delivery_scope_event(change_id,created_at DESC);
