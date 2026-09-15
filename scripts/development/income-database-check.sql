-- Local synthetic WI-013 fixture only. Every attempted change is rolled back.
BEGIN;
DO $$
BEGIN
  BEGIN
    UPDATE project_income SET amount=0 WHERE id='e501d8a7-650f-446c-8a69-ffb8675d2601';
    RAISE EXCEPTION 'Expected positive amount constraint';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS positive amount check'; END;
  BEGIN
    UPDATE project_income SET confirmer_id=owner_id WHERE id='e501d8a7-650f-446c-8a69-ffb8675d2601';
    RAISE EXCEPTION 'Expected independent confirmer constraint';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS independent confirmer check'; END;
  BEGIN
    UPDATE income_forecast_book SET currency='USD' WHERE id='d041271f-2d9d-4bd4-8c89-a031fa238c95';
    RAISE EXCEPTION 'Expected project-month-currency uniqueness';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS unique monthly currency book'; END;
  BEGIN
    UPDATE income_forecast_book SET current_revision_id='dbd69015-11e4-4515-8e87-2f839610fa12' WHERE id='d041271f-2d9d-4bd4-8c89-a031fa238c95';
    RAISE EXCEPTION 'Expected same-book revision constraint';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS same-book revision foreign key'; END;
  BEGIN
    UPDATE project_income SET status='CONFIRMED', submitted_by=owner_id, submitted_at=CURRENT_TIMESTAMP, confirmed_by=confirmer_id, confirmed_at=CURRENT_TIMESTAMP WHERE id='de72f8af-8933-4c35-961d-e3c15f829dbd';
    RAISE EXCEPTION 'Expected one confirmed reversal per original';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS one confirmed reversal per original'; END;
END $$;
ROLLBACK;
