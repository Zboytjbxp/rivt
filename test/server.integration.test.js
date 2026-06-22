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
    assert.equal(body.dependencies.database, "missing");
    assert.equal(body.observability.errorMonitoring.mode, "setup_required");
    assert.equal("dsn" in body.observability.errorMonitoring, false);
    assert.equal("bucket" in body, false);
    assert.equal("endpoint" in body, false);
  });
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
