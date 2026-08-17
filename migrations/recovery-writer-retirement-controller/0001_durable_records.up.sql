CREATE SCHEMA rivt_recovery_control;

REVOKE ALL ON SCHEMA rivt_recovery_control FROM PUBLIC;

CREATE TABLE rivt_recovery_control.controller_schema_metadata (
  singleton boolean PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  schema_version integer NOT NULL CHECK (schema_version = 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO rivt_recovery_control.controller_schema_metadata (singleton, schema_version)
VALUES (TRUE, 1);

CREATE TABLE rivt_recovery_control.writer_retirement_records (
  run_id text PRIMARY KEY CHECK (run_id ~ '^run-[a-f0-9]{48}$'),
  revision bigint NOT NULL CHECK (revision > 0),
  fencing_token bigint NOT NULL CHECK (fencing_token > 0),
  state text NOT NULL CHECK (state IN (
    'registered',
    'retirement_requested',
    'retiring',
    'retirement_unverified',
    'quarantined',
    'retired'
  )),
  retirement_deadline_at timestamptz NOT NULL,
  attempt_lease_expires_at timestamptz,
  due_at timestamptz,
  record jsonb NOT NULL CHECK (
    jsonb_typeof(record) = 'object'
    AND record ?& ARRAY[
      'schema',
      'runId',
      'runNonce',
      'bindingDigestSha256',
      'writerControlEvidenceLevel',
      'retirementDescriptorReference',
      'retirementDescriptorIdentitySha256',
      'retirementDeadlineAt',
      'retirementProofDeadlineAt',
      'writerSessionExpiresAt',
      'state',
      'revision',
      'fencingToken',
      'registeredAt',
      'retirementRequestedAt',
      'retirementTrigger',
      'writerOutcome',
      'retiringAt',
      'attemptLeaseExpiresAt',
      'retirementAttempts',
      'retiredAt',
      'retirementVerificationSha256',
      'completionEligible',
      'lastFailureCode',
      'quarantinedAt',
      'quarantineReason'
    ]::text[]
    AND record - ARRAY[
      'schema',
      'runId',
      'runNonce',
      'bindingDigestSha256',
      'writerControlEvidenceLevel',
      'retirementDescriptorReference',
      'retirementDescriptorIdentitySha256',
      'retirementDeadlineAt',
      'retirementProofDeadlineAt',
      'writerSessionExpiresAt',
      'state',
      'revision',
      'fencingToken',
      'registeredAt',
      'retirementRequestedAt',
      'retirementTrigger',
      'writerOutcome',
      'retiringAt',
      'attemptLeaseExpiresAt',
      'retirementAttempts',
      'retiredAt',
      'retirementVerificationSha256',
      'completionEligible',
      'lastFailureCode',
      'quarantinedAt',
      'quarantineReason'
    ]::text[] = '{}'::jsonb
    AND octet_length(record::text) <= 32768
  ),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((record ->> 'schema' = 'rivt-recovery-writer-retirement-record-v1') IS TRUE),
  CHECK ((record ->> 'runId' = run_id) IS TRUE),
  CHECK (((record ->> 'revision')::bigint = revision) IS TRUE),
  CHECK (((record ->> 'fencingToken')::bigint = fencing_token) IS TRUE),
  CHECK ((record ->> 'state' = state) IS TRUE),
  CHECK (((record ->> 'retirementDeadlineAt')::timestamptz = retirement_deadline_at) IS TRUE),
  CHECK (
    (
      (record -> 'attemptLeaseExpiresAt' = 'null'::jsonb AND attempt_lease_expires_at IS NULL)
      OR (record ->> 'attemptLeaseExpiresAt')::timestamptz = attempt_lease_expires_at
    ) IS TRUE
  ),
  CHECK (
    (
      (state = 'registered' AND due_at = retirement_deadline_at)
      OR (
        state = 'retiring'
        AND attempt_lease_expires_at IS NOT NULL
        AND due_at = attempt_lease_expires_at
      )
      OR (
        state IN ('retirement_requested', 'retirement_unverified')
        AND due_at = (record ->> 'retirementRequestedAt')::timestamptz
      )
      OR (
        state = 'quarantined'
        AND due_at = (record ->> 'quarantinedAt')::timestamptz
      )
      OR (state = 'retired' AND due_at IS NULL)
    ) IS TRUE
  )
);

CREATE INDEX writer_retirement_records_due_idx
  ON rivt_recovery_control.writer_retirement_records (due_at, run_id)
  WHERE due_at IS NOT NULL;

REVOKE ALL ON TABLE rivt_recovery_control.controller_schema_metadata FROM PUBLIC;
REVOKE ALL ON TABLE rivt_recovery_control.writer_retirement_records FROM PUBLIC;
