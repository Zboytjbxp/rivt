import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import pg from "pg";

export const GENERATED_CODE_BYTES = 32;
export const MIN_EXPLICIT_CODE_LENGTH = 32;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_MANUAL_INPUT_BYTES = 512;
const OPTION_KINDS = new Map([
  ["create", "flag"],
  ["status", "flag"],
  ["update", "flag"],
  ["revoke", "flag"],
  ["allow-manual-code", "flag"],
  ["invite-id", "value"],
  ["update-max-uses", "value"],
  ["email", "value"],
  ["role", "value"],
  ["days", "value"],
  ["max-uses", "value"],
]);
const MODE_OPTIONS = {
  create: new Set(["create", "allow-manual-code", "email", "role", "days", "max-uses"]),
  status: new Set(["status", "invite-id"]),
  update: new Set(["update", "invite-id", "update-max-uses"]),
  revoke: new Set(["revoke", "invite-id"]),
};

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateInviteCode(randomBytesFunction = randomBytes) {
  return `rivt_${randomBytesFunction(GENERATED_CODE_BYTES).toString("base64url")}`;
}

export function validateRequestedCode(code) {
  if (!code) return null;
  if (code.length < MIN_EXPLICIT_CODE_LENGTH || code.length > 128 || !CODE_PATTERN.test(code)) {
    return `Manual invite code must be ${MIN_EXPLICIT_CODE_LENGTH}-128 characters using letters, numbers, underscores, or hyphens.`;
  }

  const characterClasses = [/[a-z]/, /[A-Z]/, /[0-9]/, /[_-]/]
    .filter((pattern) => pattern.test(code)).length;
  if (characterClasses < 4) {
    return "Manual invite code must include a lowercase letter, uppercase letter, number, and underscore or hyphen.";
  }
  return null;
}

function normalizeManualInput(value) {
  const withoutTerminator = value.endsWith("\r\n")
    ? value.slice(0, -2)
    : value.endsWith("\n") || value.endsWith("\r")
      ? value.slice(0, -1)
      : value;
  if (withoutTerminator.includes("\n") || withoutTerminator.includes("\r")) {
    throw new Error("Manual invite input must contain exactly one line.");
  }
  return withoutTerminator;
}

async function readManualCodeFromPipe(input) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of input) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    totalBytes += buffer.length;
    if (totalBytes > MAX_MANUAL_INPUT_BYTES) {
      throw new Error("Manual invite input exceeded the secure input limit.");
    }
    chunks.push(buffer);
  }
  return normalizeManualInput(Buffer.concat(chunks).toString("utf8"));
}

function readManualCodeFromTty(input, output) {
  if (typeof input.setRawMode !== "function") {
    throw new Error("The terminal does not support hidden input.");
  }

  return new Promise((resolve, reject) => {
    const wasPaused = typeof input.isPaused === "function" ? input.isPaused() : false;
    const wasRaw = input.isRaw === true;
    let value = "";

    const cleanup = () => {
      input.off("data", onData);
      input.off("error", onError);
      input.off("end", onEnd);
      if (!wasRaw) input.setRawMode(false);
      if (wasPaused && typeof input.pause === "function") input.pause();
    };
    const finish = (callback, result) => {
      cleanup();
      output.write("\n");
      callback(result);
    };
    const onError = () => finish(reject, new Error("Manual invite input failed."));
    const onEnd = () => finish(resolve, value);
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") {
          finish(reject, new Error("Manual invite input was cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish(resolve, value);
          return;
        }
        if (character === "\u0008" || character === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " " && character <= "~") {
          value += character;
          if (Buffer.byteLength(value, "utf8") > MAX_MANUAL_INPUT_BYTES) {
            finish(reject, new Error("Manual invite input exceeded the secure input limit."));
            return;
          }
        }
      }
    };

    output.write("Manual invite code (input hidden): ");
    input.on("data", onData);
    input.once("error", onError);
    input.once("end", onEnd);
    input.setRawMode(true);
    input.resume();
  });
}

export async function readManualCodeFromStdin({ input = process.stdin, output = process.stderr } = {}) {
  return input.isTTY
    ? readManualCodeFromTty(input, output)
    : readManualCodeFromPipe(input);
}

function readOptions(args) {
  const options = new Map();
  for (const argument of args) {
    if (!argument.startsWith("--") || argument.length === 2) {
      return { error: "Arguments must use supported --option forms.", options };
    }

    const body = argument.slice(2);
    const equalsIndex = body.indexOf("=");
    const name = equalsIndex === -1 ? body : body.slice(0, equalsIndex);
    const kind = OPTION_KINDS.get(name);
    if (!kind) {
      return {
        error: name === "code"
          ? "Unknown option: --code. Raw invite codes are accepted only through protected input with --allow-manual-code."
          : "Unknown option.",
        options,
      };
    }
    if (options.has(name)) {
      return { error: `Duplicate option: --${name}.`, options };
    }
    if (kind === "flag" && equalsIndex !== -1) {
      return { error: `--${name} does not accept a value.`, options };
    }
    if (kind === "value" && equalsIndex === -1) {
      return { error: `--${name} requires a value using --${name}=...`, options };
    }

    const value = kind === "flag" ? true : body.slice(equalsIndex + 1).trim();
    if (kind === "value" && !value) {
      return { error: `--${name} cannot be empty.`, options };
    }
    options.set(name, value);
  }
  return { error: null, options };
}

function parseInteger(value, fallback) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) return Number.NaN;
  return Number(value);
}

export function parseInviteArguments(args) {
  const parsed = readOptions(args);
  const supplied = parsed.options;
  const requestedModes = ["create", "status", "update", "revoke"].filter((name) => supplied.has(name));
  const mode = requestedModes.length === 1 ? requestedModes[0] : null;
  const manualCodeRequested = supplied.has("allow-manual-code");
  const inviteId = supplied.get("invite-id") || "";
  const updateMaxUsesArgument = supplied.get("update-max-uses");
  const email = String(supplied.get("email") || "").toLowerCase();
  const role = supplied.get("role") || "";
  const days = parseInteger(supplied.get("days"), 14);
  const maxUses = parseInteger(supplied.get("max-uses"), 1);
  const updateMaxUses = parseInteger(updateMaxUsesArgument, 0);

  let error = parsed.error;
  if (!error && requestedModes.length !== 1) {
    error = "Choose exactly one operation: --create, --status, --update, or --revoke.";
  } else if (!error) {
    const unsupported = [...supplied.keys()].find((name) => !MODE_OPTIONS[mode].has(name));
    if (unsupported) error = `--${unsupported} cannot be used with --${mode}.`;
  }
  if (!error && mode !== "create" && !inviteId) {
    error = `--${mode} requires --invite-id.`;
  } else if (!error && inviteId && !UUID_PATTERN.test(inviteId)) {
    error = "--invite-id must be a valid UUID.";
  } else if (!error && mode === "update" && updateMaxUsesArgument === undefined) {
    error = "--update requires --update-max-uses.";
  } else if (!error && mode === "update" && (!Number.isInteger(updateMaxUses) || updateMaxUses < 1 || updateMaxUses > 5000)) {
    error = "--update-max-uses must be an integer between 1 and 5000.";
  } else if (!error && role && !["contractor", "tradesperson"].includes(role)) {
    error = "--role must be contractor or tradesperson.";
  } else if (!error && (!Number.isInteger(days) || days < 1 || days > 90)) {
    error = "--days must be an integer between 1 and 90.";
  } else if (!error && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 5000)) {
    error = "--max-uses must be an integer between 1 and 5000.";
  }

  return {
    error,
    mode,
    manualCodeRequested,
    inviteId,
    updateMaxUses,
    email,
    role,
    days,
    maxUses,
  };
}

function inviteSummary(invite) {
  return {
    inviteId: invite.id,
    role: invite.allowed_role,
    maxUses: invite.max_uses,
    useCount: invite.use_count,
    expiresAt: invite.expires_at,
    revokedAt: invite.revoked_at,
  };
}

export async function runInviteCommand({
  args,
  databaseUrl,
  pgssl,
  Pool = pg.Pool,
  randomBytesFunction = randomBytes,
  readManualCode = readManualCodeFromStdin,
  stdout = console.log,
  stderr = console.error,
}) {
  const options = parseInviteArguments(args);
  if (options.error) {
    stderr(options.error);
    return 1;
  }
  if (!databaseUrl?.trim()) {
    stderr("DATABASE_URL is required.");
    return 1;
  }

  let requestedCode = "";
  if (options.manualCodeRequested) {
    try {
      requestedCode = await readManualCode();
    } catch {
      stderr("Manual invite code could not be read securely.");
      return 1;
    }
    if (!requestedCode) {
      stderr("Manual invite code is required when --allow-manual-code is set.");
      return 1;
    }
    const requestedCodeError = validateRequestedCode(requestedCode);
    if (requestedCodeError) {
      stderr(requestedCodeError);
      return 1;
    }
  }

  const pool = new Pool({
    connectionString: databaseUrl.trim(),
    ssl: pgssl === "disable" ? false : { rejectUnauthorized: false },
  });

  try {
    if (options.mode === "status") {
      const result = await pool.query(
        `SELECT id, allowed_role, max_uses, use_count, expires_at, revoked_at
         FROM signup_invites
         WHERE id = $1`,
        [options.inviteId],
      );
      const invite = result.rows[0];
      if (!invite) {
        stderr("No invite found for that invite ID.");
        return 1;
      }
      stdout(JSON.stringify(inviteSummary(invite), null, 2));
      return 0;
    }

    if (options.mode === "update") {
      const result = await pool.query(
        `UPDATE signup_invites
         SET max_uses = GREATEST(max_uses, $1)
         WHERE id = $2 AND revoked_at IS NULL
         RETURNING id, allowed_role, max_uses, use_count, expires_at, revoked_at`,
        [options.updateMaxUses, options.inviteId],
      );
      const invite = result.rows[0];
      if (!invite) {
        stderr("No active invite found for that invite ID.");
        return 1;
      }
      stdout(JSON.stringify(inviteSummary(invite), null, 2));
      return 0;
    }

    if (options.mode === "revoke") {
      const result = await pool.query(
        `UPDATE signup_invites
         SET revoked_at = now()
         WHERE id = $1 AND revoked_at IS NULL
         RETURNING id, allowed_role, max_uses, use_count, expires_at, revoked_at`,
        [options.inviteId],
      );
      const invite = result.rows[0];
      if (!invite) {
        stderr("No active invite found for that invite ID.");
        return 1;
      }
      stdout(JSON.stringify(inviteSummary(invite), null, 2));
      return 0;
    }

    const rawCode = requestedCode || generateInviteCode(randomBytesFunction);
    const result = await pool.query(
      `INSERT INTO signup_invites (code_hash, email_hash, allowed_role, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, now() + ($5 * interval '1 day'))
       RETURNING id, allowed_role, max_uses, expires_at`,
      [sha256(rawCode), options.email ? sha256(options.email) : null, options.role || null, options.maxUses, options.days],
    );
    const invite = result.rows[0];
    const renderedInvite = {
      inviteId: invite.id,
      role: invite.allowed_role,
      maxUses: invite.max_uses,
      expiresAt: invite.expires_at,
    };
    if (!options.manualCodeRequested) renderedInvite.code = rawCode;
    stdout(JSON.stringify(renderedInvite, null, 2));
    stderr(options.manualCodeRequested
      ? "The manual code was accepted from protected input and was not echoed. RIVT only stores its hash."
      : "Store the generated code securely. RIVT only stores its hash and cannot display it again.");
    return 0;
  } finally {
    await pool.end();
  }
}

export async function main() {
  const exitCode = await runInviteCommand({
    args: process.argv.slice(2),
    databaseUrl: process.env.DATABASE_URL,
    pgssl: process.env.PGSSL,
  });
  process.exitCode = exitCode;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await main();
}
