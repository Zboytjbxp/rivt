import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  collectPublicDocsFindings,
  inspectPublicDocsText,
} from "../scripts/public-docs-safety-check.js";
import { runInviteCommand } from "../scripts/create-pilot-invite.js";

const INVITE_ID = "123e4567-e89b-42d3-a456-426614174000";

function generatedInvitePool() {
  return class MockPool {
    async query() {
      return {
        rows: [{
          id: INVITE_ID,
          allowed_role: null,
          max_uses: 1,
          expires_at: "2026-08-15T00:00:00.000Z",
        }],
      };
    }

    async end() {}
  };
}

test("public docs safety rejects personal-domain email addresses", () => {
  const findings = inspectPublicDocsText(
    "docs/operations/example.md",
    "Backup route: person@gmail.com",
  );

  assert.deepEqual(findings.map((entry) => entry.code), ["PERSONAL_EMAIL_IN_PUBLIC_DOCS"]);
});

test("public docs safety permits only explicitly approved organizational and example email routes", () => {
  const unsafe = [
    "Backup route: person@contractor-company.invalid",
    "Escalation route: founder@rivt.pro",
  ];
  const safe = [
    "Support route: support@rivt.pro",
    "Security route: security@rivt.pro",
    "Example only: user@example.com",
  ];

  for (const sample of unsafe) {
    assert.equal(
      inspectPublicDocsText("docs/operations/example.md", sample)
        .some((entry) => entry.code === "PERSONAL_EMAIL_IN_PUBLIC_DOCS"),
      true,
      sample,
    );
  }
  for (const sample of safe) {
    assert.equal(inspectPublicDocsText("docs/operations/example.md", sample).length, 0, sample);
  }
});

test("public docs safety rejects literal invite authority but permits withheld records", () => {
  const unsafe = inspectPublicDocsText(
    "docs/delivery/example.md",
    "## Pilot invite\n- code: `named-pilot-code`\n- invite id: `opaque-record-id`",
  );
  const safe = inspectPublicDocsText(
    "docs/delivery/example.md",
    "## Pilot invite\n- code: `[WITHHELD]`\n- invite id: `opaque-record-id`",
  );

  assert.equal(unsafe.some((entry) => entry.code === "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS"), true);
  assert.equal(safe.some((entry) => entry.code === "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS"), false);
});

test("public docs safety catches unquoted, camel, snake, hash, and query-parameter invite leaks", () => {
  const samples = [
    "Pilot invite code: named-pilot-code",
    "Access code: named-access-code",
    "inviteCode: named-pilot-code",
    "invite_code=named-pilot-code",
    "accessToken: named-pilot-token",
    "https://rivt.pro/signup?inviteCode=named-pilot-code",
    `invite_code_hash: ${"a".repeat(64)}`,
  ];

  for (const sample of samples) {
    const findings = inspectPublicDocsText("public/example.txt", sample);
    assert.equal(
      findings.some((entry) => [
        "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS",
        "INVITE_DERIVED_SECRET_IN_PUBLIC_DOCS",
      ].includes(entry.code)),
      true,
      sample,
    );
  }

  assert.equal(inspectPublicDocsText("package.json", '"invite:create": "node script.js"').length, 0);
  assert.equal(inspectPublicDocsText("docs/example.md", "Invalid invite: explains next steps.").length, 0);
});

test("public docs safety rejects the exact generated invite JSON through the docs collector", async (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-public-docs-invite-"));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  const stdout = [];
  const exitCode = await runInviteCommand({
    args: ["--create"],
    databaseUrl: "postgres://example.invalid/rivt",
    Pool: generatedInvitePool(),
    randomBytesFunction: (bytes) => Buffer.alloc(bytes, 0xa5),
    stdout: (value) => stdout.push(String(value)),
    stderr: () => {},
  });
  const rendered = stdout.join("\n");
  const evidencePath = path.join(rootDir, "docs", "delivery", "invite-output.json");
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, rendered);

  assert.equal(exitCode, 0);
  assert.match(rendered, /"code": "rivt_[A-Za-z0-9_-]+"/);
  assert.equal(
    collectPublicDocsFindings(rootDir).some((entry) => (
      entry.filePath === "docs/delivery/invite-output.json"
      && entry.code === "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS"
    )),
    true,
  );
});

test("public docs safety handles quoted invite keys without rejecting placeholders or generic code fields", () => {
  const unsafeSamples = [
    '{"inviteCode": "named-pilot-code"}',
    '{"invite_code": "named-pilot-code"}',
    '{"accessToken": "named-access-token"}',
    '{"access_token": "named-access-token"}',
    '{"pilotCode": "QAT91"}',
    "{'pilot_code': 'QAT91'}",
    '`inviteCode`: `named-pilot-code`',
    '{"pilot invite code": "named-pilot-code"}',
    '{"inviteId": "opaque-record-id", "code": "rivt_named-pilot-code"}',
  ];
  const safeSamples = [
    '{"inviteCode": "[WITHHELD]"}',
    '{"access_token": "<access-token>"}',
    '{"inviteId": "opaque-record-id", "code": "[REDACTED]"}',
    '{"code": "build-identifier"}',
  ];

  for (const sample of unsafeSamples) {
    assert.equal(
      inspectPublicDocsText("docs/delivery/example.json", sample)
        .some((entry) => entry.code === "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS"),
      true,
      sample,
    );
  }
  for (const sample of safeSamples) {
    assert.equal(inspectPublicDocsText("docs/delivery/example.json", sample).length, 0, sample);
  }
});

test("public docs safety catches invite authority written as ordinary prose", () => {
  const unsafeSamples = [
    "Pilot invite code QAT91",
    "Use invite code QAT91 for signup.",
    "The access code is QAT91.",
    "Share the pilot invite token `Long_Manual-Invite_Code_2026_Xyz9`.",
  ];
  const safeSamples = [
    "Pilot invite code `[WITHHELD]`.",
    "Use invite code <invite-code> for signup.",
    "The access code is REDACTED.",
    "Pilot invite code EXAMPLE.",
    "The pilot invite code remains required.",
    "Invite code should be optional only if launch strategy permits.",
  ];

  for (const sample of unsafeSamples) {
    assert.equal(
      inspectPublicDocsText("docs/example.md", sample)
        .some((entry) => entry.code === "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS"),
      true,
      sample,
    );
  }
  for (const sample of safeSamples) {
    assert.equal(inspectPublicDocsText("docs/example.md", sample).length, 0, sample);
  }
});

test("public docs safety permits named invite placeholders but rejects arbitrary angle-bracket values", () => {
  const safe = inspectPublicDocsText(
    "docs/example.md",
    "Use invite code <invite-code> for signup.",
  );
  const unsafe = inspectPublicDocsText(
    "docs/example.md",
    "Use invite code <live-pilot-authority> for signup.",
  );

  assert.equal(safe.length, 0);
  assert.equal(
    unsafe.some((entry) => entry.code === "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS"),
    true,
  );
});

test("public docs safety rejects private-roster identity and family relationship prose", () => {
  const named = inspectPublicDocsText(
    "docs/operations/example.md",
    "Backup owner: Private Person",
  );
  const relationship = inspectPublicDocsText(
    "docs/operations/example.md",
    "Backup incident owner is a partner / wife with contact details in the roster.",
  );
  const safe = inspectPublicDocsText(
    "docs/operations/example.md",
    "Backup owner role: `backup-incident-owner`; contact route: `private-backup-route`.",
  );

  assert.equal(named.some((entry) => entry.code === "PRIVATE_ROSTER_IDENTITY_IN_PUBLIC_DOCS"), true);
  assert.equal(relationship.some((entry) => entry.code === "PRIVATE_ROSTER_RELATIONSHIP_IN_PUBLIC_DOCS"), true);
  assert.equal(safe.length, 0);
});

test("public docs safety rejects a single name linked to a private operational role", () => {
  const unsafeSamples = [
    "Backup incident owner: Sampleperson",
    "Backup ownership is recorded, but Sampleperson still needs access/runbook orientation.",
    "Incident commander is Sampleperson pending private-roster onboarding.",
  ];
  const safeSamples = [
    "Backup incident owner: Unassigned",
    "Backup ownership is recorded, but the role still needs access/runbook orientation.",
    "Incident commander role: `incident-commander`; contact route: `primary-route`.",
  ];

  for (const sample of unsafeSamples) {
    assert.equal(
      inspectPublicDocsText("docs/operations/example.md", sample)
        .some((entry) => entry.code === "PRIVATE_ROSTER_IDENTITY_IN_PUBLIC_DOCS"),
      true,
      sample,
    );
  }
  for (const sample of safeSamples) {
    assert.equal(inspectPublicDocsText("docs/operations/example.md", sample).length, 0, sample);
  }
});

test("public docs safety rejects personal names in operational approval and owner prose", () => {
  const unsafeSamples = [
    "Michael approved the exact disabled payment configuration.",
    "Michael's exact approval remains bound to the evidence digest.",
    "At the recorded time, Michael supplied this approval.",
    "Incident owner Michael stated the forensic limitation.",
    "Support owner: Michael at support@rivt.pro.",
  ];
  const safeSamples = [
    "The founder role approved the exact disabled payment configuration.",
    "The founder role's exact approval remains bound to the evidence digest.",
    "At the recorded time, the founder role supplied this approval.",
    "The incident-owner role recorded the forensic limitation.",
    "Support owner role: `support-owner` via support@rivt.pro.",
  ];

  for (const sample of unsafeSamples) {
    assert.equal(
      inspectPublicDocsText("docs/operations/example.md", sample)
        .some((entry) => entry.code === "PERSONAL_OPERATIONAL_IDENTITY_IN_PUBLIC_DOCS"),
      true,
      sample,
    );
  }
  for (const sample of safeSamples) {
    assert.equal(inspectPublicDocsText("docs/operations/example.md", sample).length, 0, sample);
  }
});

test("public docs collector scans textual SVG, JavaScript, and Mermaid assets", (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "rivt-public-docs-"));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  fs.mkdirSync(path.join(rootDir, "docs"), { recursive: true });
  fs.mkdirSync(path.join(rootDir, "public"), { recursive: true });
  fs.writeFileSync(path.join(rootDir, "docs", "routing.mmd"), "backup --> person@outside.invalid\n");
  fs.writeFileSync(path.join(rootDir, "public", "contact.svg"), "<text>person@outside.invalid</text>\n");
  fs.writeFileSync(path.join(rootDir, "public", "config.js"), "export const route = 'person@outside.invalid';\n");

  const findings = collectPublicDocsFindings(rootDir)
    .filter((entry) => entry.code === "PERSONAL_EMAIL_IN_PUBLIC_DOCS");

  assert.deepEqual(
    findings.map((entry) => entry.filePath).sort(),
    ["docs/routing.mmd", "public/config.js", "public/contact.svg"],
  );
});

test("public incident routing accepts role and route IDs but rejects personal contact fields", () => {
  const safeRouting = JSON.stringify({
    primaryOwner: { roleId: "incident-commander", contactRouteId: "primary-route" },
    contactRoutes: [{ id: "primary-route", status: "configured" }],
  });
  const unsafeRouting = JSON.stringify({
    primaryOwner: { name: "Named Person", email: "person@example.test" },
  });

  assert.equal(inspectPublicDocsText("docs/operations/incident-routing.json", safeRouting).length, 0);
  assert.deepEqual(
    inspectPublicDocsText("docs/operations/incident-routing.json", unsafeRouting)
      .map((entry) => entry.code),
    ["PERSONAL_CONTACT_FIELD_IN_PUBLIC_ROUTING", "PERSONAL_CONTACT_FIELD_IN_PUBLIC_ROUTING"],
  );
});

test("public operational JSON permits role identifiers but rejects personal owner and approver values", () => {
  const unsafe = JSON.stringify({
    backupSchedule: { owner: "Michael" },
    approval: { approvedBy: "Michael" },
  });
  const safe = JSON.stringify({
    backupSchedule: { owner: "backup-operations-owner" },
    approval: { approvedBy: "founder" },
  });

  assert.equal(
    inspectPublicDocsText("docs/operations/recovery-policy.json", unsafe)
      .filter((entry) => entry.code === "PERSONAL_OPERATIONAL_IDENTITY_IN_PUBLIC_JSON").length,
    2,
  );
  assert.equal(inspectPublicDocsText("docs/operations/recovery-policy.json", safe).length, 0);
});

test("public operations guidance cannot require personal owner names and emails", () => {
  const unsafe = inspectPublicDocsText(
    "docs/operations/example.md",
    "Primary and backup incident owners with real names and emails.",
  );
  const safe = inspectPublicDocsText(
    "docs/operations/example.md",
    "Backup incident role with an access-controlled private contact route.",
  );

  assert.equal(
    unsafe.some((entry) => entry.code === "PERSONAL_CONTACT_INSTRUCTION_IN_PUBLIC_DOCS"),
    true,
  );
  assert.equal(safe.length, 0);
});

test("synthetic workflow must not publish routing names or email addresses", () => {
  const unsafe = inspectPublicDocsText(
    ".github/workflows/production-synthetic.yml",
    "const owner = `${routing.primaryOwner.name} <${routing.primaryOwner.email}>`;",
  );
  const safe = inspectPublicDocsText(
    ".github/workflows/production-synthetic.yml",
    "const owner = `${routing.primaryOwner.roleId} via ${routing.primaryOwner.contactRouteId}`;",
  );

  assert.equal(unsafe.filter((entry) => entry.code === "PERSONAL_CONTACT_IN_PUBLIC_ISSUE_BODY").length, 2);
  assert.equal(safe.length, 0);
});
