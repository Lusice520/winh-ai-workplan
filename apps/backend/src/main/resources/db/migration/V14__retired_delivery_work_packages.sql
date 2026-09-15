-- V12 used an unnamed check; resolve only the constraint on this column.
DO $$
DECLARE delivery_constraint TEXT;
BEGIN
  FOR delivery_constraint IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'project_work_item'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%delivery_state%'
  LOOP
    EXECUTE format('ALTER TABLE project_work_item DROP CONSTRAINT %I', delivery_constraint);
  END LOOP;
END $$;
ALTER TABLE project_work_item ADD CONSTRAINT project_work_item_delivery_state_check
  CHECK (delivery_state IN ('NOT_REQUIRED','AWAITING_BASELINE','PREPARING','IN_REVIEW','BASELINED','LEGACY_COMPLETE','RETIRED'));
