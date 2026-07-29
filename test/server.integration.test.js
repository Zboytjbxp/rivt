import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "";
process.env.S3_BUCKET = "";
process.env.S3_ACCESS_KEY_ID = "";
process.env.S3_SECRET_ACCESS_KEY = "";

const { app } = await import("../server/index.js");

async function withServer(run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("public health is safe and reports unavailable dependencies", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.ok, false);
    assert.equal(body.migration.state, "pending");
    assert.equal("error" in body.migration, false);
    assert.equal(body.dependencies.database, "missing");
    assert.equal(body.observability.errorMonitoring.mode, "setup_required");
    assert.equal("dsn" in body.observability.errorMonitoring, false);
    assert.equal(body.security.passwordBreachScreening.provider, "pwned-passwords");
    assert.equal(body.security.passwordBreachScreening.mode, "disabled");
    assert.equal("bucket" in body, false);
    assert.equal("endpoint" in body, false);
  });
});

test("production health exposes invalid session security without secret detail", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousPepper = process.env.AUTH_METADATA_PEPPER;
  process.env.NODE_ENV = "production";
  process.env.AUTH_METADATA_PEPPER = " ".repeat(64);
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();
      assert.equal(response.status, 503);
      assert.deepEqual(body.security.sessionSecurity, {
        ok: false,
        provider: "session_security",
        mode: "setup_required",
      });
      assert.equal(JSON.stringify(body).includes("AUTH_METADATA_PEPPER"), false);
    });
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousPepper === undefined) delete process.env.AUTH_METADATA_PEPPER;
    else process.env.AUTH_METADATA_PEPPER = previousPepper;
  }
});

test("unsafe cross-origin request is rejected before account work", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
      body: JSON.stringify({ email: "attacker@example.com", password: "not-used" }),
    });
    assert.equal(response.status, 403);
  });
});

test("guest authentication is unavailable by default", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/guest`, {
      method: "POST",
      headers: { Origin: "https://rivt.pro" },
    });
    assert.equal(response.status, 404);
  });
});
