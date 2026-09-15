-- WI-013: explicit project-management income currency/month; no implicit company role grants.
CREATE TABLE income_forecast_book (
 id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, project_id UUID NOT NULL REFERENCES project_space(id),
 period VARCHAR(7) NOT NULL CHECK(period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), currency VARCHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 current_revision_id UUID, draft_revision_id UUID, UNIQUE(project_id,period,currency)
);
CREATE TABLE income_forecast_revision (
 id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, book_id UUID NOT NULL REFERENCES income_forecast_book(id), number INTEGER NOT NULL CHECK(number>0),
 status VARCHAR(16) NOT NULL CHECK(status IN ('DRAFT','PUBLISHED','DISCARDED')), lines_json TEXT NOT NULL,
 reason VARCHAR(4000) NOT NULL, edited_by UUID NOT NULL REFERENCES user_account(id), published_by UUID REFERENCES user_account(id), published_at TIMESTAMPTZ,
 UNIQUE(book_id,number), UNIQUE(book_id,id), CHECK((status='PUBLISHED' AND published_by IS NOT NULL AND published_at IS NOT NULL) OR (status<>'PUBLISHED' AND published_by IS NULL AND published_at IS NULL))
);
CREATE UNIQUE INDEX ux_income_forecast_single_draft ON income_forecast_revision(book_id) WHERE status='DRAFT';
ALTER TABLE income_forecast_book ADD CONSTRAINT fk_income_current_revision FOREIGN KEY(id,current_revision_id) REFERENCES income_forecast_revision(book_id,id);
ALTER TABLE income_forecast_book ADD CONSTRAINT fk_income_draft_revision FOREIGN KEY(id,draft_revision_id) REFERENCES income_forecast_revision(book_id,id);
CREATE TABLE project_income (
 id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, project_id UUID NOT NULL REFERENCES project_space(id),
 kind VARCHAR(16) NOT NULL CHECK(kind IN ('INCOME','REVERSAL')), status VARCHAR(16) NOT NULL CHECK(status IN ('DRAFT','SUBMITTED','RETURNED','CONFIRMED','CANCELLED')),
 title VARCHAR(160) NOT NULL, amount NUMERIC(14,2) NOT NULL CHECK(amount>0), currency VARCHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), occurred_on DATE NOT NULL,
 source_note VARCHAR(4000) NOT NULL, source_json TEXT NOT NULL, forecast_json TEXT NOT NULL, unplanned_reason VARCHAR(4000), original_income_id UUID,
 created_by UUID NOT NULL REFERENCES user_account(id), owner_id UUID NOT NULL REFERENCES user_account(id), confirmer_id UUID NOT NULL REFERENCES user_account(id),
 submitted_by UUID REFERENCES user_account(id), submitted_at TIMESTAMPTZ, confirmed_by UUID REFERENCES user_account(id), confirmed_at TIMESTAMPTZ, files_json TEXT NOT NULL,
 UNIQUE(project_id,id), FOREIGN KEY(project_id,original_income_id) REFERENCES project_income(project_id,id),
 CHECK(original_income_id IS NULL OR original_income_id<>id), CHECK(kind<>'REVERSAL' OR original_income_id IS NOT NULL), CHECK(owner_id<>confirmer_id),
 CHECK(status NOT IN ('SUBMITTED','CONFIRMED') OR (submitted_by IS NOT NULL AND submitted_at IS NOT NULL AND submitted_by<>confirmer_id)),
 CHECK((status='CONFIRMED' AND confirmed_by=confirmer_id AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL AND confirmed_by<>submitted_by) OR (status<>'CONFIRMED' AND confirmed_by IS NULL AND confirmed_at IS NULL))
);
CREATE INDEX ix_income_period ON project_income(project_id,currency,occurred_on DESC);
CREATE UNIQUE INDEX ux_income_one_confirmed_reversal ON project_income(original_income_id) WHERE kind='REVERSAL' AND status='CONFIRMED';
CREATE TABLE project_income_event (
 id UUID PRIMARY KEY, version BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, project_id UUID NOT NULL REFERENCES project_space(id), object_id UUID NOT NULL,
 object_type VARCHAR(16) NOT NULL CHECK(object_type IN ('INCOME','FORECAST')), action VARCHAR(32) NOT NULL, reason VARCHAR(4000) NOT NULL,
 actor_id UUID NOT NULL REFERENCES user_account(id), before_json TEXT NOT NULL, after_json TEXT NOT NULL
);
CREATE INDEX ix_income_event ON project_income_event(project_id,object_id,created_at);
INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('35a4432a-b3c6-5ba3-96bc-a653c7964220','FINANCE_READ','查看经营预测与收入','finance.read','ACTION','NORMAL',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('6c196aad-b029-5f10-941b-90c7463ffea0','FINANCE_FORECAST_EDIT','维护并发布收入预测','finance.forecast.edit','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('fb00aefa-22b9-58bf-8c65-94876529a938','FINANCE_INCOME_SUBMIT','填报实际收入与冲销','finance.income.submit','ACTION','HIGH',TRUE,'ENABLED');
INSERT INTO permission_item(id,code,name,action_key,dimension,risk_level,can_delegate,status) VALUES ('7a53912b-3499-5d9d-aab1-effe2d26ab74','FINANCE_INCOME_CONFIRM','独立确认实际收入与冲销','finance.income.confirm','ACTION','HIGH',TRUE,'ENABLED');
