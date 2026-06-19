import assert from "node:assert/strict";
import test from "node:test";
import { assertActiveActor, requireOrganizationRole } from "../server/authorization.js";

function actor(overrides = {}) {
  return {
    account: { id: "account-1", status: "active", primaryRole: "contractor" },
    profile: {},
    memberships: [
      { organizationId: "org-1", role: "owner", status: "active" },
      { organizationId: "org-2", role: "member", status: "active" },
      { organizationId: "org-3", role: "admin", status: "removed" },
    ],
    ...overrides,
  };
}

test("organization policy allows only active memberships with an allowed role", () => {
  assert.equal(requireOrganizationRole(actor(), "org-1").role, "owner");
  assert.throws(
    () => requireOrganizationRole(actor(), "org-2"),
    (error) => error.status === 403 && error.code === "ORGANIZATION_ACCESS_DENIED",
  );
  assert.throws(
    () => requireOrganizationRole(actor(), "other-org"),
    (error) => error.status === 403 && error.code === "ORGANIZATION_ACCESS_DENIED",
  );
  assert.throws(
    () => requireOrganizationRole(actor(), "org-3", ["admin"]),
    (error) => error.status === 403 && error.code === "ORGANIZATION_ACCESS_DENIED",
  );
});

test("inactive accounts fail closed before capability evaluation", () => {
  for (const status of ["onboarding", "suspended", "closed"]) {
    const inactive = actor({ account: { id: "account-1", status, primaryRole: "contractor" } });
    assert.throws(
      () => assertActiveActor(inactive),
      (error) => error.status === 403 && error.code === "ACCOUNT_NOT_ACTIVE",
    );
  }
});
