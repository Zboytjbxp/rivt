CREATE OR REPLACE FUNCTION bridge_auth_user_to_account() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO accounts (id, status, primary_role, created_at, updated_at)
  VALUES (
    NEW.id,
    CASE WHEN NEW.role = 'pending' THEN 'onboarding' ELSE 'active' END,
    CASE WHEN NEW.role IN ('pending', 'contractor', 'tradesperson') THEN NEW.role ELSE 'pending' END,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth_identities (
    account_id, provider, provider_subject, subject_kind, email, email_hash, created_at, updated_at
  )
  VALUES (
    NEW.id,
    CASE WHEN NEW.provider IN ('email', 'google', 'facebook', 'apple') THEN NEW.provider ELSE 'email' END,
    NEW.email_hash,
    'legacy_email_hash',
    NEW.email,
    NEW.email_hash,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (account_id, provider) DO NOTHING;

  INSERT INTO profiles (
    account_id, display_name, location_text, visibility, onboarding_status, created_at, updated_at
  )
  VALUES (NEW.id, NEW.display_name, NEW.location, 'private', 'draft', NEW.created_at, NEW.updated_at)
  ON CONFLICT (account_id) DO NOTHING;

  RETURN NEW;
END;
$$;

ALTER TABLE profiles
  DROP COLUMN avatar_upload_id,
  DROP COLUMN phone_visibility,
  DROP COLUMN phone_e164,
  DROP COLUMN contact_email_visibility,
  DROP COLUMN availability_status,
  DROP COLUMN service_radius_miles,
  DROP COLUMN country_code,
  DROP COLUMN service_area_region,
  DROP COLUMN service_area_city;

DROP TABLE signup_invites;
DROP TABLE oauth_transactions;
DROP TABLE password_reset_tokens;
DROP TABLE email_verification_tokens;

DROP INDEX auth_sessions_active_user_idx;

ALTER TABLE auth_sessions
  DROP COLUMN device_label,
  DROP COLUMN ip_hash,
  DROP COLUMN user_agent_hash,
  DROP COLUMN revoked_at,
  DROP COLUMN last_seen_at;

ALTER TABLE auth_users
  DROP COLUMN last_login_at,
  DROP COLUMN email_verified_at;
DELETE FROM trades
WHERE code IN ('excavation', 'fencing', 'gutters', 'windows_doors', 'driveways_pavers', 'pool_spa', 'security_systems')
  AND NOT EXISTS (SELECT 1 FROM profile_trades WHERE profile_trades.trade_code = trades.code);
