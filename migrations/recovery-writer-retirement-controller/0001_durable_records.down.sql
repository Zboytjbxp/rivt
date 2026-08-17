LOCK TABLE rivt_recovery_control.writer_retirement_records
  IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM rivt_recovery_control.writer_retirement_records
      LIMIT 1
  ) THEN
    RAISE EXCEPTION 'refusing to remove nonempty writer-retirement evidence';
  END IF;
END
$$;

DROP TABLE rivt_recovery_control.writer_retirement_records;
DROP TABLE rivt_recovery_control.controller_schema_metadata;
DROP SCHEMA rivt_recovery_control;
