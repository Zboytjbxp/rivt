import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { PassThrough, Readable } from "node:stream";
import test from "node:test";
import {
  GENERATED_CODE_BYTES,
  generateInviteCode,
  parseInviteArguments,
  readManualCodeFromStdin,
  runInviteCommand,
  sha256,
  validateRequestedCode,
} from "../scripts/create-pilot-invite.js";

const INVITE_ID = "123e4567-e89b-42d3-a456-426614174000";

function mockPoolWith(row) {
  const calls = [];
  let ended = false;
  class MockPool {
    async query(text, values) {
      calls.push({ text, values });
      return { rows: row ? [row] : [] };
    }

    async end() {
      ended = true;
    }
  }
  return { MockPool, calls, ended: () => ended };
}

function captureOutput() {
  const stdout = [];
  const stderr = [];
  return {
    stdout,
    stderr,
    log: (value) => stdout.push(String(value)),
    error: (value) => stderr.push(String(value)),
  };
}

test("generated invite codes contain 256 bits of random material", () => {
  let requestedBytes = 0;
  const code = generateInviteCode((bytes) => {
    requestedBytes = bytes;
    return Buffer.alloc(bytes, 0xa5);
  });

  assert.equal(GENERATED_CODE_BYTES, 32);
  assert.equal(requestedBytes, 32);
  const decoded = Buffer.from(code.slice("rivt_".length), "base64url");
  assert.equal(decoded.length, 32);
});

test("explicit invite codes must meet the strong minimum", () => {
  assert.match(validateRequestedCode("short"), /32-128/);
  assert.match(validateRequestedCode("a".repeat(40)), /lowercase.*uppercase.*number.*underscore/i);
  assert.equal(validateRequestedCode("Long_Manual-Invite_Code_2026_Xyz9"), null);
});

test("management operations require invite ID and reject raw-code management", () => {
  assert.match(
    parseInviteArguments(["--update", "--update-max-uses=10"]).error,
    /requires --invite-id/,
  );
  assert.match(
    parseInviteArguments(["--status", `--invite-id=${INVITE_ID}`, "--code=Long_Manual-Invite_Code_2026_Xyz9"]).error,
    /Unknown option: --code/,
  );
  assert.equal(
    parseInviteArguments(["--status", `--invite-id=${INVITE_ID}`]).error,
    null,
  );
  assert.match(
    parseInviteArguments(["--revoke"]).error,
    /requires --invite-id/,
  );
  assert.match(
    parseInviteArguments(["--revoke", `--invite-id=${INVITE_ID}`, "--code=Long_Manual-Invite_Code_2026_Xyz9"]).error,
    /Unknown option: --code/,
  );
  assert.equal(
    parseInviteArguments(["--revoke", `--invite-id=${INVITE_ID}`]).error,
    null,
  );
});

test("parser fails closed on missing, unknown, duplicate, empty, and malformed options", () => {
  assert.match(parseInviteArguments([]).error, /exactly one operation/);
  assert.match(parseInviteArguments(["--creat"]).error, /Unknown option/);
  assert.match(parseInviteArguments(["--create", "--create"]).error, /Duplicate option/);
  assert.match(parseInviteArguments(["--status=true"]).error, /does not accept a value/);
  assert.match(
    parseInviteArguments(["--status", "--revoke", `--invite-id=${INVITE_ID}`]).error,
    /exactly one operation/,
  );
  assert.match(
    parseInviteArguments(["--update", `--invite-id=${INVITE_ID}`, "--update-max-uses="]).error,
    /cannot be empty/,
  );
  assert.match(
    parseInviteArguments(["--update", `--invite-id=${INVITE_ID}`, "--update-max-uses=10junk"]).error,
    /integer between 1 and 5000/,
  );
  assert.match(
    parseInviteArguments(["--create", "--days=14days"]).error,
    /days must be an integer/,
  );
});

test("manual code creation rejects argv values and requires the safe-input override", async () => {
  const code = "Long_Manual-Invite_Code_2026_Xyz9";
  assert.match(
    parseInviteArguments(["--create", `--code=${code}`]).error,
    /Unknown option: --code/,
  );
  const options = parseInviteArguments(["--create", "--allow-manual-code"]);
  assert.equal(options.error, null);
  assert.equal(options.manualCodeRequested, true);

  const input = Readable.from([`${code}\n`]);
  const output = { write() {} };
  assert.equal(await readManualCodeFromStdin({ input, output }), code);
});

test("interactive manual input disables terminal echo and restores terminal mode", async () => {
  const code = "Long_Manual-Invite_Code_2026_Xyz9";
  const input = new PassThrough();
  const rawModes = [];
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (enabled) => {
    input.isRaw = enabled;
    rawModes.push(enabled);
  };
  const writes = [];
  const output = { write: (value) => writes.push(String(value)) };

  const resultPromise = readManualCodeFromStdin({ input, output });
  input.write(`${code}\r`);
  const result = await resultPromise;

  assert.equal(result, code);
  assert.deepEqual(rawModes, [true, false]);
  assert.doesNotMatch(writes.join(""), new RegExp(code));
  assert.match(writes.join(""), /input hidden/i);
});

test("rejected positional argv input is never reflected in parser errors", () => {
  const code = "Long_Manual-Invite_Code_2026_Xyz9";
  const parsed = parseInviteArguments(["--create", "--allow-manual-code", code]);

  assert.match(parsed.error, /supported --option forms/i);
  assert.doesNotMatch(parsed.error, new RegExp(code));
});

test("invalid arguments fail before a database pool can be constructed", async () => {
  class ForbiddenPool {
    constructor() {
      throw new Error("pool must not be constructed");
    }
  }
  const output = captureOutput();
  const exitCode = await runInviteCommand({
    args: ["--creat"],
    databaseUrl: "postgres://example.invalid/rivt",
    Pool: ForbiddenPool,
    stdout: output.log,
    stderr: output.error,
  });
  assert.equal(exitCode, 1);
  assert.match(output.stderr.join("\n"), /Unknown option/);
});

test("manual create reads the code outside argv, stores only its hash, and never echoes it", async () => {
  const code = "Long_Manual-Invite_Code_2026_Xyz9";
  const pool = mockPoolWith({
    id: INVITE_ID,
    allowed_role: "contractor",
    max_uses: 3,
    expires_at: "2026-08-15T00:00:00.000Z",
  });
  const output = captureOutput();

  const exitCode = await runInviteCommand({
    args: ["--create", "--allow-manual-code", "--role=contractor", "--max-uses=3"],
    databaseUrl: "postgres://example.invalid/rivt",
    Pool: pool.MockPool,
    readManualCode: async () => code,
    stdout: output.log,
    stderr: output.error,
  });

  assert.equal(exitCode, 0);
  assert.equal(pool.calls.length, 1);
  assert.equal(pool.calls[0].values[0], sha256(code));
  assert.doesNotMatch(pool.calls[0].text, /RETURNING[^]*code_hash/i);
  assert.doesNotMatch(output.stdout.join("\n"), new RegExp(code));
  assert.doesNotMatch(output.stderr.join("\n"), new RegExp(code));
  assert.doesNotMatch(output.stdout.join("\n"), /email/i);
  assert.equal(pool.ended(), true);
});

test("manual create rejects empty protected input before database setup", async () => {
  class ForbiddenPool {
    constructor() {
      throw new Error("pool must not be constructed");
    }
  }
  const output = captureOutput();

  const exitCode = await runInviteCommand({
    args: ["--create", "--allow-manual-code"],
    databaseUrl: "postgres://example.invalid/rivt",
    Pool: ForbiddenPool,
    readManualCode: async () => "",
    stdout: output.log,
    stderr: output.error,
  });

  assert.equal(exitCode, 1);
  assert.match(output.stderr.join("\n"), /Manual invite code is required/);
});

test("generated create remains the default and does not read manual input", async () => {
  const generatedCode = `rivt_${Buffer.alloc(32, 0xa5).toString("base64url")}`;
  const pool = mockPoolWith({
    id: INVITE_ID,
    allowed_role: null,
    max_uses: 1,
    expires_at: "2026-08-15T00:00:00.000Z",
  });
  const output = captureOutput();

  const exitCode = await runInviteCommand({
    args: ["--create"],
    databaseUrl: "postgres://example.invalid/rivt",
    Pool: pool.MockPool,
    randomBytesFunction: (bytes) => Buffer.alloc(bytes, 0xa5),
    readManualCode: async () => {
      throw new Error("manual input must not be read");
    },
    stdout: output.log,
    stderr: output.error,
  });

  assert.equal(exitCode, 0);
  assert.equal(pool.calls[0].values[0], sha256(generatedCode));
  assert.match(output.stdout.join("\n"), new RegExp(generatedCode));
  assert.equal(pool.ended(), true);
});

test("max-use update uses invite ID and never emits a raw code or hash", async () => {
  const pool = mockPoolWith({
    id: INVITE_ID,
    code_hash: "should-not-leak",
    allowed_role: "tradesperson",
    max_uses: 25,
    use_count: 4,
    expires_at: "2026-08-15T00:00:00.000Z",
    revoked_at: null,
  });
  const output = captureOutput();

  const exitCode = await runInviteCommand({
    args: ["--update", `--invite-id=${INVITE_ID}`, "--update-max-uses=25"],
    databaseUrl: "postgres://example.invalid/rivt",
    Pool: pool.MockPool,
    stdout: output.log,
    stderr: output.error,
  });

  const rendered = output.stdout.join("\n");
  assert.equal(exitCode, 0);
  assert.match(pool.calls[0].text, /WHERE id = \$2/);
  assert.deepEqual(pool.calls[0].values, [25, INVITE_ID]);
  assert.doesNotMatch(rendered, /should-not-leak|code_hash|"code"/i);
  assert.match(rendered, new RegExp(INVITE_ID));
  assert.equal(pool.ended(), true);
});

test("status uses invite ID and returns only non-secret metadata", async () => {
  const pool = mockPoolWith({
    id: INVITE_ID,
    code_hash: "should-not-leak",
    allowed_role: null,
    max_uses: 1,
    use_count: 0,
    expires_at: "2026-08-15T00:00:00.000Z",
    revoked_at: null,
  });
  const output = captureOutput();

  const exitCode = await runInviteCommand({
    args: ["--status", `--invite-id=${INVITE_ID}`],
    databaseUrl: "postgres://example.invalid/rivt",
    Pool: pool.MockPool,
    stdout: output.log,
    stderr: output.error,
  });

  const rendered = output.stdout.join("\n");
  assert.equal(exitCode, 0);
  assert.match(pool.calls[0].text, /WHERE id = \$1/);
  assert.deepEqual(pool.calls[0].values, [INVITE_ID]);
  assert.doesNotMatch(rendered, /should-not-leak|code_hash|"code"/i);
  assert.equal(pool.ended(), true);
});

test("revoke uses invite ID, revokes only an active invite, and returns non-secret metadata", async () => {
  const pool = mockPoolWith({
    id: INVITE_ID,
    code_hash: "should-not-leak",
    email_hash: "also-should-not-leak",
    allowed_role: "contractor",
    max_uses: 1,
    use_count: 0,
    expires_at: "2026-08-15T00:00:00.000Z",
    revoked_at: "2026-08-01T12:00:00.000Z",
  });
  const output = captureOutput();

  const exitCode = await runInviteCommand({
    args: ["--revoke", `--invite-id=${INVITE_ID}`],
    databaseUrl: "postgres://example.invalid/rivt",
    Pool: pool.MockPool,
    stdout: output.log,
    stderr: output.error,
  });

  const rendered = output.stdout.join("\n");
  assert.equal(exitCode, 0);
  assert.match(pool.calls[0].text, /SET revoked_at = now\(\)/);
  assert.match(pool.calls[0].text, /WHERE id = \$1 AND revoked_at IS NULL/);
  assert.deepEqual(pool.calls[0].values, [INVITE_ID]);
  assert.doesNotMatch(rendered, /should-not-leak|code_hash|email_hash|"code"/i);
  assert.match(rendered, new RegExp(INVITE_ID));
  assert.equal(pool.ended(), true);
});

test("revoke does not report success for a missing or already revoked invite", async () => {
  const pool = mockPoolWith(null);
  const output = captureOutput();

  const exitCode = await runInviteCommand({
    args: ["--revoke", `--invite-id=${INVITE_ID}`],
    databaseUrl: "postgres://example.invalid/rivt",
    Pool: pool.MockPool,
    stdout: output.log,
    stderr: output.error,
  });

  assert.equal(exitCode, 1);
  assert.equal(output.stdout.length, 0);
  assert.match(output.stderr.join("\n"), /No active invite found/);
  assert.equal(pool.ended(), true);
});
