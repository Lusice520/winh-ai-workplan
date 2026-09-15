CREATE TABLE contract_node_revision (
    id UUID PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contract_id UUID NOT NULL REFERENCES contract_master(id),
    node_id UUID NOT NULL REFERENCES contract_node(id),
    kind VARCHAR(32) NOT NULL CHECK (kind IN ('BASELINE','CREATED','COMPLETED','TERMS_CORRECTED','COMPLETION_CORRECTED','COMPLETION_REOPENED')),
    before_snapshot TEXT,
    after_snapshot TEXT NOT NULL,
    reason VARCHAR(2000) NOT NULL,
    recorded_by UUID REFERENCES user_account(id)
);

CREATE INDEX ix_contract_node_revision_contract ON contract_node_revision(contract_id, created_at DESC);
CREATE INDEX ix_contract_node_revision_node ON contract_node_revision(node_id, created_at DESC);

-- Preserve existing facts at adoption time, without fabricating original operators or events.
INSERT INTO contract_node_revision(id,contract_id,node_id,kind,after_snapshot,reason)
SELECT gen_random_uuid(),n.contract_id,n.id,'BASELINE',
    jsonb_build_object('version',n.version,'recordId',n.record_id,'title',n.title,'kind',n.kind,
        'dueDate',n.due_date,'amount',n.amount,'conditions',n.conditions,'status',n.status,
        'completedOn',n.completed_on,'evidence',n.evidence,'completedBy',n.completed_by)::text,
    '启用节点历史时保留的现存事实；原操作人未补造。'
FROM contract_node n;
