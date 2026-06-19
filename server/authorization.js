import { ApiError } from "./api.js";

export async function loadActorContext(database, accountId) {
  const accountResult = await database.query(
    `
      SELECT a.id, a.status, a.primary_role,
             p.display_name, p.headline, p.bio, p.location_text,
             p.visibility, p.onboarding_status
      FROM accounts a
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

  const row = accountResult.rows[0];
  return {
    account: {
      id: row.id,
      status: row.status,
      primaryRole: row.primary_role,
    },
    profile: {
      displayName: row.display_name,
      headline: row.headline,
      bio: row.bio,
      locationText: row.location_text,
      visibility: row.visibility,
      onboardingStatus: row.onboarding_status,
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
