\set ON_ERROR_STOP on
-- Synthetic fixture only. Every attempted illegal update rolls back in its
-- subtransaction; the outer transaction also rolls back unconditionally.
BEGIN;
DO $$
DECLARE target_id UUID; source_id UUID; rejected BOOLEAN;
BEGIN
  SELECT id INTO STRICT target_id FROM project_work_item
    WHERE id='88cff366-3747-45ec-9917-436fcda49824' AND creation_source='DELIVERY_TASK' AND kind='TASK' AND source_requirement_id IS NULL;
  SELECT source_requirement_id INTO STRICT source_id FROM project_work_item
    WHERE id='74cc63e6-a688-4d7c-bb8b-416be433db64' AND creation_source='REQUIREMENT';
  rejected := false;
  BEGIN
    UPDATE project_work_item SET creation_source='DELIVERY' WHERE id=target_id;
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'A TASK cannot claim the original WORK_PACKAGE creation source'; END IF;
  rejected := false;
  BEGIN
    UPDATE project_work_item SET creation_source='REQUIREMENT' WHERE id=target_id;
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'A requirement source requires an actual requirement'; END IF;
  rejected := false;
  BEGIN
    UPDATE project_work_item SET source_requirement_id=source_id WHERE id=target_id;
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'A newly created delivery TASK cannot manufacture a requirement source'; END IF;
  RAISE NOTICE 'PASS all three illegal source combinations rejected by PostgreSQL; original task source retained';
END $$;
ROLLBACK;
SELECT version, success FROM flyway_schema_history WHERE version IN ('12','19','20') ORDER BY installed_rank;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid='project_work_item'::regclass AND conname='project_work_item_creation_source_check';
