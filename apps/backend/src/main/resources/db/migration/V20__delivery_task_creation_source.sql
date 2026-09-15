-- Preserve V12's original source rules and allow a task created directly in an
-- approved delivery work package. Applied migrations remain immutable.
DO $$
DECLARE source_constraint TEXT;
BEGIN
  FOR source_constraint IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'project_work_item'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%creation_source%'
  LOOP
    EXECUTE format('ALTER TABLE project_work_item DROP CONSTRAINT %I', source_constraint);
  END LOOP;
END $$;

ALTER TABLE project_work_item ADD CONSTRAINT project_work_item_creation_source_check
  CHECK (
    (creation_source = 'REQUIREMENT' AND source_requirement_id IS NOT NULL)
    OR (creation_source = 'DELIVERY' AND kind = 'WORK_PACKAGE' AND source_requirement_id IS NULL)
    OR (creation_source = 'DELIVERY_TASK' AND kind = 'TASK' AND source_requirement_id IS NULL)
  );
