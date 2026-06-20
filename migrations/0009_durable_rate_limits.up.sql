CREATE TABLE rate_limit_windows (
  namespace text NOT NULL CHECK (char_length(namespace) BETWEEN 1 AND 80),
  subject_hash text NOT NULL CHECK (char_length(subject_hash) BETWEEN 32 AND 128),
  window_start_at timestamptz NOT NULL,
  window_seconds integer NOT NULL CHECK (window_seconds BETWEEN 1 AND 86400),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  first_request_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (namespace, subject_hash, window_start_at)
);

CREATE INDEX rate_limit_windows_expiry_idx
  ON rate_limit_windows (expires_at);

CREATE INDEX rate_limit_windows_namespace_updated_idx
  ON rate_limit_windows (namespace, updated_at DESC);
