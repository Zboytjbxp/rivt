import { ApiError } from "./api.js";

export async function loadActorContext(database, accountId) {
  const accountResult = await database.query(
    `
      SELECT a.id, a.status, a.primary_role, u.email, u.provider, u.email_verified_at,
             p.display_name, p.headline, p.bio, p.location_text,
             p.visibility, p.onboarding_status, p.service_area_city,
             p.service_area_region, p.country_code, p.service_radius_miles,
             p.availability_status, p.contact_email_visibility,
             p.phone_e164, p.phone_visibility, p.avatar_upload_id
      FROM accounts a
      INNER JOIN auth_users u ON u.id = a.id
      INNER JOIN profiles p ON p.account_id = a.id
      WHERE a.id = $1
      LIMIT 1
    `,
    [accountId],
  );

  if (!accountResult.rowCount) {
    throw new ApiError(409, "ACCOUNT_MIGRATION_REQUIRED", "This account is not ready for the current API.");
  }

  const memberships = await database.query(
    `
      SELECT m.organization_id, m.membership_role, m.status, o.name
      FROM organization_memberships m
      INNER JOIN organizations o ON o.id = m.organization_id
      WHERE m.account_id = $1 AND m.status = 'active' AND o.status = 'active'
      ORDER BY o.name, m.organization_id
    `,
    [accountId],
  );

  const trades = await database.query(
    `SELECT t.code, t.name, pt.is_primary
     FROM profile_trades pt INNER JOIN trades t ON t.code = pt.trade_code
     WHERE pt.account_id = $1 AND t.active = true
     ORDER BY pt.is_primary DESC, t.sort_order, t.code`,
    [accountId],
  );

  const row = accountResult.rows[0];
  return {
    account: {
      id: row.id,
      status: row.status,
      primaryRole: row.primary_role,
      email: row.email,
      provider: row.provider,
      emailVerified: Boolean(row.email_verified_at),
    },
    profile: {
      displayName: row.display_name,
      headline: row.headline,
      bio: row.bio,
      locationText: row.location_text,
      visibility: row.visibility,
      onboardingStatus: row.onboarding_status,
      serviceArea: {
        city: row.service_area_city,
        region: row.service_area_region,
        countryCode: row.country_code,
        radiusMiles: row.service_radius_miles,
      },
      availabilityStatus: row.availability_status,
      contactEmailVisibility: row.contact_email_visibility,
      phoneE164: row.phone_e164,
      phoneVisibility: row.phone_visibility,
      avatarUploadId: row.avatar_upload_id,
      trades: trades.rows.map((trade) => ({ code: trade.code, name: trade.name, primary: trade.is_primary })),
    },
    memberships: memberships.rows.map((membership) => ({
      organizationId: membership.organization_id,
      organizationName: membership.name,
      role: membership.membership_role,
      status: membership.status,
    })),
  };
}

export function assertActiveActor(actor) {
  if (!actor || actor.account.status !== "active") {
    throw new ApiError(403, "ACCOUNT_NOT_ACTIVE", "This account cannot perform that action.");
  }
  return actor;
}

export function requireOrganizationRole(actor, organizationId, allowedRoles = ["owner", "admin"]) {
  assertActiveActor(actor);
  const membership = actor.memberships.find((candidate) => (
    candidate.organizationId === organizationId
    && candidate.status === "active"
    && allowedRoles.includes(candidate.role)
  ));
  if (!membership) {
    throw new ApiError(403, "ORGANIZATION_ACCESS_DENIED", "You do not have access to that organization.");
  }
  return membership;
}
