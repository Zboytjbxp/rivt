import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const scannedExtensions = new Set([".html", ".js", ".json", ".md", ".mmd", ".svg", ".txt", ".xml", ".yaml", ".yml"]);
const emailAddressPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const safeOrganizationalEmailAddresses = new Set([
  "security@rivt.pro",
  "support@rivt.pro",
]);
const safeDocumentationEmailDomains = new Set([
  "example.com",
  "example.net",
  "example.org",
  "example.test",
]);
const secretAssignmentPattern = /\b(?:invite|access|pilot)\s+(?:code|token)[`"']?\s*[:=]\s*[`"']([^`"']+)[`"']/gi;
const contextualCodePattern = /\bcode[`"']?\s*:\s*[`"']([^`"']+)[`"']/gi;
const inviteContextPattern = /\binvite(?:\b|[_-]?(?:id|code|token)\b)/i;
const inviteAssignmentPattern = /\b(?:invite(?:Code|_code|Token|_token)|access(?:Code|_code|Token|_token)|pilot(?:Code|_code))[`"']?\s*[:=]\s*[`"']?([A-Za-z0-9_-]{5,128})[`"']?/gi;
const spacedInviteAssignmentPattern = /\b(?:pilot\s+invite|invite|access)\s+(?:code|token)[`"']?\s*[:=]\s*[`"']?([A-Za-z0-9_-]{5,128})[`"']?/gi;
const inviteQueryPattern = /[?&](?:invite(?:Code|_code|Token|_token)?|access(?:Code|_code|Token|_token)|pilot(?:Code|_code))=([^&#\s`"']+)/gi;
const inviteDerivedSecretPattern = /\b(?:invite(?:Code|_code)?(?:Hash|_hash)|code_hash)[`"']?\s*[:=]\s*[`"']?([a-f0-9]{16,128})[`"']?/gi;
const naturalLanguageInvitePattern = /\b(?:(?:use|enter|provide|share)\s+(?:the\s+)?(?:pilot\s+)?(?:invite|access)|(?:the\s+)?(?:pilot\s+invite|invite|access|pilot))\s+(?:code|token)(?:\s+is)?\s+(?:[`"']([^`"'\r\n]{1,128})[`"']|(\[[^\]\r\n]{1,64}\]|<[^>\r\n]{1,64}>|[A-Za-z0-9][A-Za-z0-9_-]{4,127}))/gi;
const safePlaceholderValues = new Set([
  "...",
  "omitted",
  "[omitted]",
  "redacted",
  "[redacted]",
  "withheld",
  "[withheld]",
  "<access-code>",
  "<access-token>",
  "<invite-code>",
  "<invite-token>",
  "<pilot-code>",
  "<pilot-invite-code>",
  "<pilot-token>",
]);
const safeNaturalLanguageValues = /^(?:disabled|example|expired|generated|invalid|missing|optional|placeholder|remains|required|revoked|should|unavailable)$/i;
const forbiddenRoutingKeys = new Set(["approvedBy", "commander", "email", "name", "phone"]);
const operationalIdentityJsonKeys = new Set(["approvedBy", "owner"]);
const safeOperationalRoleValues = new Set([
  "founder",
  "missing",
  "operations",
  "pending",
  "private",
  "redacted",
  "role",
  "tbd",
  "unassigned",
  "unavailable",
  "unknown",
  "withheld",
]);
const publicOperationalRoleIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-(?:commander|operator|owner|role)$/;
const safeOperationalIdentitySubjects = new Set([
  "claude",
  "codex",
  "founder",
  "google",
  "incident",
  "legal",
  "operations",
  "operator",
  "owner",
  "product",
  "railway",
  "recorded",
  "reviewer",
  "rivt",
  "role",
  "security",
  "stripe",
  "support",
  "system",
  "user",
]);
const singleNameOperationalRolePatterns = [
  /\b(?:[Pp]rimary|[Bb]ackup)(?:\s+[Ii]ncident)?\s+[Oo]wner\s*(?::|\s+(?:[Ii]s|[Ww]as|[Aa]ssigned\s+to|[Hh]eld\s+by))\s*([A-Z][A-Za-z'-]{1,39})\b(?!\s+[A-Z][A-Za-z'-]{1,39}\b)/g,
  /\b[Ii]ncident\s+[Cc]ommander\s*(?::|\s+(?:[Ii]s|[Ww]as|[Aa]ssigned\s+to|[Hh]eld\s+by))\s*([A-Z][A-Za-z'-]{1,39})\b(?!\s+[A-Z][A-Za-z'-]{1,39}\b)/g,
  /\b[Bb]ackup\s+[Oo]wnership\s+[Ii]s\s+[Rr]ecorded,\s+[Bb]ut\s+([A-Z][A-Za-z'-]{1,39})\b\s+(?:[Ss]till\s+)?(?:needs|must|should|has|will)\b/g,
];
const operationalDecisionContextPattern = /\b(?:approval|authorization|backup|configuration|credential|deploy(?:ment)?|disabled\s+mode|forensic|gate\s+a|incident|launch|payment|policy|production|provider|recovery)\b/i;
const personalOperationalIdentityPatterns = [
  {
    pattern: /\b([A-Z][A-Za-z'-]{1,39})\s+(?:(?:approved\s+(?:only\b|(?:only\s+)?(?:the|this|that|RIVT['’]s|Gate\s+A))|accepted\s+(?:the|these|this|that)|supplied\s+(?:the|this|that))|stated(?=\s*:))/g,
    requiresContext: true,
  },
  { pattern: /\b([A-Z][A-Za-z'-]{1,39})['’]s\s+(?:exact\s+)?(?:approval|statement|incident\s+(?:authorization|authority))\b/g },
  { pattern: /\b(?:[Ii]ncident|[Ss]upport|[Bb]ackup|[Pp]rimary|[Oo]perations|[Pp]ayment)\s+(?:[Aa]pprover|[Cc]ommander|[Cc]ommunicator|[Oo]wner)\s*(?::\s*|\s+(?:is|was|named|recorded\s+as)?\s*)([A-Z][A-Za-z'-]{1,39})\b/g },
  { pattern: /\b[Aa]pprover\s*:\s*([A-Z][A-Za-z'-]{1,39})\b/g },
];

function isPublicOperationalRoleId(value) {
  if (typeof value !== "string") return value == null;
  const normalized = value.trim().toLowerCase();
  return safeOperationalRoleValues.has(normalized) || publicOperationalRoleIdPattern.test(normalized);
}

function isSafePublicEmail(value) {
  const normalized = value.toLowerCase();
  if (safeOrganizationalEmailAddresses.has(normalized)) return true;
  const domain = normalized.slice(normalized.lastIndexOf("@") + 1);
  return safeDocumentationEmailDomains.has(domain);
}

function isSafePlaceholder(value) {
  return safePlaceholderValues.has(value.trim().toLowerCase());
}

function relativePath(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function finding(filePath, line, code, message) {
  return { filePath, line, code, message };
}

function walkJsonKeys(value, visit, currentPath = "$") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkJsonKeys(entry, visit, `${currentPath}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visit(key, child, `${currentPath}.${key}`);
    walkJsonKeys(child, visit, `${currentPath}.${key}`);
  }
}

export function inspectPublicDocsText(filePath, text) {
  const findings = [];
  let match;

  emailAddressPattern.lastIndex = 0;
  while ((match = emailAddressPattern.exec(text))) {
    if (isSafePublicEmail(match[0])) continue;
    findings.push(finding(
      filePath,
      lineNumberAt(text, match.index),
      "PERSONAL_EMAIL_IN_PUBLIC_DOCS",
      "Use an explicitly approved organizational route or an opaque private-roster reference instead of an unapproved email address.",
    ));
  }

  secretAssignmentPattern.lastIndex = 0;
  while ((match = secretAssignmentPattern.exec(text))) {
    if (!isSafePlaceholder(match[1])) {
      findings.push(finding(
        filePath,
        lineNumberAt(text, match.index),
        "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS",
        "Record an opaque invite-record reference; never publish the raw invite or access value.",
      ));
    }
  }

  for (const [pattern, code, message] of [
    [inviteAssignmentPattern, "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS", "Record an opaque invite-record reference; never publish invite authority in an assignment."],
    [spacedInviteAssignmentPattern, "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS", "Record an opaque invite-record reference; never publish invite authority in an assignment."],
    [inviteQueryPattern, "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS", "Remove invite authority from the published URL or query parameter."],
    [inviteDerivedSecretPattern, "INVITE_DERIVED_SECRET_IN_PUBLIC_DOCS", "Do not publish a raw invite hash or fingerprint derived from a short code."],
  ]) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text))) {
      if (!isSafePlaceholder(match[1])) {
        findings.push(finding(filePath, lineNumberAt(text, match.index), code, message));
      }
    }
  }

  naturalLanguageInvitePattern.lastIndex = 0;
  while ((match = naturalLanguageInvitePattern.exec(text))) {
    const candidate = (match[1] ?? match[2] ?? "").trim();
    if (!isSafePlaceholder(candidate) && !safeNaturalLanguageValues.test(candidate)) {
      findings.push(finding(
        filePath,
        lineNumberAt(text, match.index),
        "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS",
        "Record an opaque invite-record reference; never publish invite authority in prose.",
      ));
    }
  }

  const relationshipPattern = /\bbackup(?:\s+incident)?\s+owner\b[^\n]{0,120}\b(?:wife|husband|spouse|partner|family\s+member|daughter|son|sibling)\b/gi;
  relationshipPattern.lastIndex = 0;
  while ((match = relationshipPattern.exec(text))) {
    findings.push(finding(
      filePath,
      lineNumberAt(text, match.index),
      "PRIVATE_ROSTER_RELATIONSHIP_IN_PUBLIC_DOCS",
      "Record only the backup role and private contact-route reference, not identity or family relationship.",
    ));
  }

  const namedBackupPattern = /\bbackup(?:\s+incident)?\s+owner\s*:\s*[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)+/gi;
  namedBackupPattern.lastIndex = 0;
  while ((match = namedBackupPattern.exec(text))) {
    findings.push(finding(
      filePath,
      lineNumberAt(text, match.index),
      "PRIVATE_ROSTER_IDENTITY_IN_PUBLIC_DOCS",
      "Record only the backup role and private contact-route reference, not a person's name.",
    ));
  }

  for (const pattern of singleNameOperationalRolePatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text))) {
      if (safeOperationalRoleValues.has(match[1].toLowerCase())) continue;
      findings.push(finding(
        filePath,
        lineNumberAt(text, match.index),
        "PRIVATE_ROSTER_IDENTITY_IN_PUBLIC_DOCS",
        "Record only the operational role and private contact-route reference, not a person's name.",
      ));
    }
  }

  for (const { pattern, requiresContext = false } of personalOperationalIdentityPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text))) {
      const subject = match[1].toLowerCase();
      if (safeOperationalIdentitySubjects.has(subject) || safeOperationalRoleValues.has(subject)) continue;
      if (requiresContext) {
        const lineStart = text.lastIndexOf("\n", match.index) + 1;
        const nextLineBreak = text.indexOf("\n", match.index);
        const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
        if (!operationalDecisionContextPattern.test(text.slice(lineStart, lineEnd))) continue;
      }
      findings.push(finding(
        filePath,
        lineNumberAt(text, match.index),
        "PERSONAL_OPERATIONAL_IDENTITY_IN_PUBLIC_DOCS",
        "Attribute public operational decisions to a role identifier; keep the person's identity in an access-controlled record.",
      ));
    }
  }

  const publicContactInstructionPattern = /\b(?:primary\s+and\s+backup\s+incident\s+owners?|backup\s+incident\s+owners?)\b[^\n]{0,120}\breal\s+names?\s+and\s+emails?\b/gi;
  publicContactInstructionPattern.lastIndex = 0;
  while ((match = publicContactInstructionPattern.exec(text))) {
    findings.push(finding(
      filePath,
      lineNumberAt(text, match.index),
      "PERSONAL_CONTACT_INSTRUCTION_IN_PUBLIC_DOCS",
      "Public operations docs must require role and contact-route IDs; private identities and addresses stay in an access-controlled roster.",
    ));
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const context = lines.slice(Math.max(0, index - 10), index + 1).join("\n");
    if (!inviteContextPattern.test(context)) return;
    contextualCodePattern.lastIndex = 0;
    while ((match = contextualCodePattern.exec(line))) {
      if (!isSafePlaceholder(match[1])) {
        findings.push(finding(
          filePath,
          index + 1,
          "LITERAL_INVITE_AUTHORITY_IN_PUBLIC_DOCS",
          "Record an opaque invite-record reference; never publish the raw invite or access value.",
        ));
      }
    }
  });

  if (filePath.endsWith("docs/operations/incident-routing.json")) {
    try {
      const parsed = JSON.parse(text);
      walkJsonKeys(parsed, (key, _value, jsonPath) => {
        if (forbiddenRoutingKeys.has(key)) {
          findings.push(finding(
            filePath,
            1,
            "PERSONAL_CONTACT_FIELD_IN_PUBLIC_ROUTING",
            `Replace ${jsonPath} with a public role ID or contact-route ID.`,
          ));
        }
      });
    } catch {
      findings.push(finding(filePath, 1, "INVALID_INCIDENT_ROUTING_JSON", "Incident routing must be valid JSON."));
    }
  }

  const normalizedFilePath = filePath.replaceAll("\\", "/");
  if (normalizedFilePath.startsWith("docs/operations/") && normalizedFilePath.endsWith(".json")) {
    try {
      const parsed = JSON.parse(text);
      walkJsonKeys(parsed, (key, value, jsonPath) => {
        if (!operationalIdentityJsonKeys.has(key) || isPublicOperationalRoleId(value)) return;
        findings.push(finding(
          filePath,
          1,
          "PERSONAL_OPERATIONAL_IDENTITY_IN_PUBLIC_JSON",
          `Replace ${jsonPath} with a public role identifier; keep personal identity in an access-controlled record.`,
        ));
      });
    } catch {
      // Format-specific validators report malformed operational JSON elsewhere.
    }
  }

  if (filePath.endsWith(".github/workflows/production-synthetic.yml")) {
    const forbiddenInterpolation = /routing\.(?:primaryOwner|backupOwner)\.(?:name|email)|(?:primaryOwner|backupOwner)\.(?:name|email)/g;
    while ((match = forbiddenInterpolation.exec(text))) {
      findings.push(finding(
        filePath,
        lineNumberAt(text, match.index),
        "PERSONAL_CONTACT_IN_PUBLIC_ISSUE_BODY",
        "Synthetic issues may publish only incident role IDs and contact-route IDs.",
      ));
    }
  }

  return findings;
}

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(filePath);
    return scannedExtensions.has(path.extname(entry.name).toLowerCase()) ? [filePath] : [];
  });
}

export function collectPublicDocsFindings(rootDir = process.cwd()) {
  const rootFiles = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (
      scannedExtensions.has(path.extname(entry.name).toLowerCase()) || entry.name === ".env.example"
    ) && entry.name !== "package-lock.json")
    .map((entry) => path.join(rootDir, entry.name));
  const files = [
    ...rootFiles,
    ...collectFiles(path.join(rootDir, "docs")),
    ...collectFiles(path.join(rootDir, ".github", "workflows")),
    ...collectFiles(path.join(rootDir, "config")),
    ...collectFiles(path.join(rootDir, "public")),
  ];
  return files.flatMap((filePath) => inspectPublicDocsText(
    relativePath(rootDir, filePath),
    fs.readFileSync(filePath, "utf8"),
  ));
}

export async function main(argv = process.argv.slice(2)) {
  const requireClean = argv.includes("--require-clean");
  const jsonOnly = argv.includes("--json");
  const findings = collectPublicDocsFindings();
  const result = { ok: findings.length === 0, findings };
  if (jsonOnly || findings.length > 0) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("Public documentation safety check passed.");
  }
  if (requireClean && findings.length > 0) process.exitCode = 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
