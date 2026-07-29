import assert from "node:assert/strict";

export function assertProductionAuthProviders(payload) {
  assert.equal(
    payload?.providers?.email?.ok,
    true,
    "Email/password auth provider must remain configured.",
  );
  assert.equal(
    payload?.providers?.sessionSecurity?.ok,
    true,
    "Session metadata security must remain configured.",
  );
  assert.equal(
    payload?.providers?.sessionSecurity?.mode,
    "configured",
    "Session metadata security must report configured mode.",
  );
}
