import {
  apiPath,
  fetchWithTimeout,
  notifySessionExpired,
  requestKey,
} from "../../lib/api";

export type ContactRole =
  | "crew"
  | "subcontractor"
  | "customer"
  | "supplier"
  | "other";
export type ContactStatus = "active" | "archived";
export type ContactMethodKind = "email" | "phone" | "website";
export type ContactAddressKind = "billing" | "service" | "mailing" | "other";

export interface ContactRoleRecord {
  role: ContactRole;
  status: ContactStatus;
  details: Record<string, unknown>;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ContactMethod {
  id?: string;
  kind: ContactMethodKind;
  label: string;
  value: string;
  isPrimary: boolean;
}

export interface ContactAddress {
  id?: string;
  kind: ContactAddressKind;
  label: string;
  address: string;
  isPrimary: boolean;
}

export interface ContactRecord {
  id: string;
  entityType: "person" | "company";
  name: string;
  company: string;
  notes: string;
  favorite: boolean;
  status: ContactStatus;
  linkedAccountId: string | null;
  lastUsedAt: string | null;
  roles: ContactRoleRecord[];
  methods: ContactMethod[];
  addresses: ContactAddress[];
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ContactInput {
  entityType: "person" | "company";
  name: string;
  company: string;
  notes: string;
  favorite: boolean;
  status: ContactStatus;
  roles: ContactRoleRecord[];
  methods: ContactMethod[];
  addresses: ContactAddress[];
  tags: string[];
}

export interface ContactDuplicateCandidate {
  id: string;
  name: string;
  company: string;
}

export interface ContactMutationResult {
  contact: ContactRecord | null;
  duplicateCandidates: ContactDuplicateCandidate[];
  error: string | null;
}

export interface ContactJobLink {
  id: string;
  relationshipRole: string;
  notes: string;
  isPrimary: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  contact: ContactRecord;
}

export interface ContactProjectLink extends Omit<ContactJobLink, "contact"> {
  contact: ContactRecord;
}

export interface ContactActivity {
  id: string;
  kind: "document" | "project" | "job";
  title: string;
  status: string;
  date: string | null;
  amountCents: number | null;
  recordType: string | null;
  localId: string | null;
}

export interface ContactWorkLink {
  id: string;
  targetKind: "job" | "project";
  targetId: string;
  targetTitle: string;
  relationshipRole: string;
  notes: string;
  isPrimary: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeContact(value: unknown): ContactRecord | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
  const roles = Array.isArray(value.roles)
    ? value.roles.flatMap((role): ContactRoleRecord[] => {
        if (!isRecord(role) || !["crew", "subcontractor", "customer", "supplier", "other"].includes(String(role.role))) return [];
        return [{
          role: role.role as ContactRole,
          status: role.status === "archived" ? "archived" : "active",
          details: isRecord(role.details) ? role.details : {},
          createdAt: typeof role.createdAt === "string" ? role.createdAt : null,
          updatedAt: typeof role.updatedAt === "string" ? role.updatedAt : null,
        }];
      })
    : [];
  const methods = Array.isArray(value.methods)
    ? value.methods.flatMap((method): ContactMethod[] => {
        if (
          !isRecord(method)
          || !["email", "phone", "website"].includes(String(method.kind))
          || typeof method.value !== "string"
        ) return [];
        return [{
          id: typeof method.id === "string" ? method.id : undefined,
          kind: method.kind as ContactMethodKind,
          label: typeof method.label === "string" ? method.label : "",
          value: method.value,
          isPrimary: method.isPrimary === true,
        }];
      })
    : [];
  const addresses = Array.isArray(value.addresses)
    ? value.addresses.flatMap((address): ContactAddress[] => {
        if (
          !isRecord(address)
          || !["billing", "service", "mailing", "other"].includes(String(address.kind))
          || typeof address.address !== "string"
        ) return [];
        return [{
          id: typeof address.id === "string" ? address.id : undefined,
          kind: address.kind as ContactAddressKind,
          label: typeof address.label === "string" ? address.label : "",
          address: address.address,
          isPrimary: address.isPrimary === true,
        }];
      })
    : [];
  return {
    id: value.id,
    entityType: value.entityType === "company" ? "company" : "person",
    name: value.name,
    company: typeof value.company === "string" ? value.company : "",
    notes: typeof value.notes === "string" ? value.notes : "",
    favorite: value.favorite === true,
    status: value.status === "archived" ? "archived" : "active",
    linkedAccountId: typeof value.linkedAccountId === "string" ? value.linkedAccountId : null,
    lastUsedAt: typeof value.lastUsedAt === "string" ? value.lastUsedAt : null,
    roles,
    methods,
    addresses,
    tags: Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

async function contactRequest(
  path: string,
  options: RequestInit = {},
): Promise<{
  ok: boolean;
  contact: ContactRecord | null;
  contacts: ContactRecord[];
  duplicateCandidates: ContactDuplicateCandidate[];
  error: string | null;
}> {
  try {
    const response = await fetchWithTimeout(apiPath(path), {
      credentials: "include",
      ...options,
    });
    if (response.status === 401) notifySessionExpired();
    const body = await response.json().catch(() => null) as {
      data?: { contact?: unknown; contacts?: unknown[] };
      error?: {
        message?: string;
        details?: { candidates?: ContactDuplicateCandidate[] };
      };
    } | null;
    return {
      ok: response.ok,
      contact: normalizeContact(body?.data?.contact),
      contacts: Array.isArray(body?.data?.contacts)
        ? body!.data!.contacts!.map(normalizeContact).filter((contact): contact is ContactRecord => Boolean(contact))
        : [],
      duplicateCandidates: Array.isArray(body?.error?.details?.candidates)
        ? body!.error!.details!.candidates!
        : [],
      error: response.ok ? null : body?.error?.message ?? "RIVT could not save this contact.",
    };
  } catch {
    return {
      ok: false,
      contact: null,
      contacts: [],
      duplicateCandidates: [],
      error: "RIVT could not reach the contact directory.",
    };
  }
}

export async function fetchContacts(options: {
  role?: ContactRole;
  status?: ContactStatus | "all";
  q?: string;
} = {}): Promise<ContactRecord[] | null> {
  const params = new URLSearchParams();
  if (options.role) params.set("role", options.role);
  if (options.status) params.set("status", options.status);
  if (options.q) params.set("q", options.q);
  params.set("limit", "250");
  const result = await contactRequest(`/api/v1/contacts?${params.toString()}`);
  return result.ok ? result.contacts : null;
}

export async function fetchContact(contactId: string): Promise<ContactRecord | null> {
  const result = await contactRequest(`/api/v1/contacts/${encodeURIComponent(contactId)}`);
  return result.ok ? result.contact : null;
}

export async function createContact(input: ContactInput): Promise<ContactMutationResult> {
  const result = await contactRequest("/api/v1/contacts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": requestKey(),
    },
    body: JSON.stringify(input),
  });
  return {
    contact: result.contact,
    duplicateCandidates: result.duplicateCandidates,
    error: result.error,
  };
}

export async function updateContact(
  contactId: string,
  input: Partial<ContactInput>,
): Promise<ContactMutationResult> {
  const result = await contactRequest(`/api/v1/contacts/${encodeURIComponent(contactId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": requestKey(),
    },
    body: JSON.stringify(input),
  });
  return {
    contact: result.contact,
    duplicateCandidates: result.duplicateCandidates,
    error: result.error,
  };
}

export async function markContactUsed(contactId: string): Promise<ContactRecord | null> {
  const result = await contactRequest(`/api/v1/contacts/${encodeURIComponent(contactId)}/used`, {
    method: "POST",
    headers: { "Idempotency-Key": requestKey() },
  });
  return result.ok ? result.contact : null;
}

function normalizeJobLink(value: unknown): ContactJobLink | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const contact = normalizeContact(value.contact);
  if (!contact || typeof value.relationshipRole !== "string") return null;
  return {
    id: value.id,
    relationshipRole: value.relationshipRole,
    notes: typeof value.notes === "string" ? value.notes : "",
    isPrimary: value.isPrimary === true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
    contact,
  };
}

async function contactJobLinkRequest(
  path: string,
  options: RequestInit = {},
): Promise<{ links: ContactJobLink[]; link: ContactJobLink | null; error: string | null }> {
  try {
    const response = await fetchWithTimeout(apiPath(path), {
      credentials: "include",
      ...options,
    });
    if (response.status === 401) notifySessionExpired();
    const body = await response.json().catch(() => null) as {
      data?: { links?: unknown[]; link?: unknown };
      error?: { message?: string };
    } | null;
    return {
      links: Array.isArray(body?.data?.links)
        ? body!.data!.links!.map(normalizeJobLink).filter((link): link is ContactJobLink => Boolean(link))
        : [],
      link: normalizeJobLink(body?.data?.link),
      error: response.ok ? null : body?.error?.message ?? "RIVT could not update the job contacts.",
    };
  } catch {
    return {
      links: [],
      link: null,
      error: "RIVT could not reach the job contacts.",
    };
  }
}

export async function fetchJobContactLinks(jobId: string): Promise<ContactJobLink[] | null> {
  const result = await contactJobLinkRequest(`/api/v1/jobs/${encodeURIComponent(jobId)}/contacts`);
  return result.error ? null : result.links;
}

export async function saveJobContactLink(
  jobId: string,
  input: {
    contactId: string;
    relationshipRole: string;
    notes: string;
    isPrimary: boolean;
  },
): Promise<{ link: ContactJobLink | null; error: string | null }> {
  const result = await contactJobLinkRequest(`/api/v1/jobs/${encodeURIComponent(jobId)}/contacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": requestKey(),
    },
    body: JSON.stringify(input),
  });
  return { link: result.link, error: result.error };
}

export async function deleteJobContactLink(jobId: string, linkId: string): Promise<boolean> {
  const result = await contactJobLinkRequest(
    `/api/v1/jobs/${encodeURIComponent(jobId)}/contacts/${encodeURIComponent(linkId)}`,
    {
      method: "DELETE",
      headers: { "Idempotency-Key": requestKey() },
    },
  );
  return !result.error;
}

export async function fetchProjectContactLinks(projectId: string): Promise<ContactProjectLink[] | null> {
  const result = await contactJobLinkRequest(
    `/api/v1/standalone-projects/${encodeURIComponent(projectId)}/contacts`,
  );
  return result.error ? null : result.links;
}

export async function saveProjectContactLink(
  projectId: string,
  input: {
    contactId: string;
    relationshipRole: string;
    notes: string;
    isPrimary: boolean;
  },
): Promise<{ link: ContactProjectLink | null; error: string | null }> {
  const result = await contactJobLinkRequest(
    `/api/v1/standalone-projects/${encodeURIComponent(projectId)}/contacts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": requestKey(),
      },
      body: JSON.stringify(input),
    },
  );
  return { link: result.link, error: result.error };
}

export async function deleteProjectContactLink(projectId: string, linkId: string): Promise<boolean> {
  const result = await contactJobLinkRequest(
    `/api/v1/standalone-projects/${encodeURIComponent(projectId)}/contacts/${encodeURIComponent(linkId)}`,
    {
      method: "DELETE",
      headers: { "Idempotency-Key": requestKey() },
    },
  );
  return !result.error;
}

export async function fetchContactActivity(contactId: string): Promise<ContactActivity[] | null> {
  try {
    const response = await fetchWithTimeout(
      apiPath(`/api/v1/contacts/${encodeURIComponent(contactId)}/activity`),
      { credentials: "include" },
    );
    if (response.status === 401) notifySessionExpired();
    const body = await response.json().catch(() => null) as {
      data?: { activity?: unknown[] };
    } | null;
    if (!response.ok || !Array.isArray(body?.data?.activity)) return null;
    return body.data.activity.flatMap((value): ContactActivity[] => {
      if (
        !isRecord(value)
        || typeof value.id !== "string"
        || !["document", "project", "job"].includes(String(value.kind))
        || typeof value.title !== "string"
      ) return [];
      return [{
        id: value.id,
        kind: value.kind as ContactActivity["kind"],
        title: value.title,
        status: typeof value.status === "string" ? value.status : "",
        date: typeof value.date === "string" ? value.date : null,
        amountCents: typeof value.amountCents === "number" ? value.amountCents : null,
        recordType: typeof value.recordType === "string" ? value.recordType : null,
        localId: typeof value.localId === "string" ? value.localId : null,
      }];
    });
  } catch {
    return null;
  }
}

export async function fetchContactWorkLinks(contactId: string): Promise<ContactWorkLink[] | null> {
  try {
    const response = await fetchWithTimeout(
      apiPath(`/api/v1/contacts/${encodeURIComponent(contactId)}/work-links`),
      { credentials: "include" },
    );
    if (response.status === 401) notifySessionExpired();
    const body = await response.json().catch(() => null) as {
      data?: { links?: unknown[] };
    } | null;
    if (!response.ok || !Array.isArray(body?.data?.links)) return null;
    return body.data.links.flatMap((value): ContactWorkLink[] => {
      if (
        !isRecord(value)
        || typeof value.id !== "string"
        || !["job", "project"].includes(String(value.targetKind))
        || typeof value.targetId !== "string"
        || typeof value.targetTitle !== "string"
        || typeof value.relationshipRole !== "string"
      ) return [];
      return [{
        id: value.id,
        targetKind: value.targetKind as ContactWorkLink["targetKind"],
        targetId: value.targetId,
        targetTitle: value.targetTitle,
        relationshipRole: value.relationshipRole,
        notes: typeof value.notes === "string" ? value.notes : "",
        isPrimary: value.isPrimary === true,
        createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
      }];
    });
  } catch {
    return null;
  }
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

export function contactsCsv(contacts: ContactRecord[]) {
  const columns = ["Name", "Company", "Roles", "Email", "Phone", "Website", "Tags", "Notes", "Status"];
  const rows = contacts.map((contact) => [
    contact.name,
    contact.company,
    contact.roles.filter(({ status }) => status === "active").map(({ role }) => role).join("; "),
    contact.methods.find(({ kind, isPrimary }) => kind === "email" && isPrimary)?.value
      ?? contact.methods.find(({ kind }) => kind === "email")?.value
      ?? "",
    contact.methods.find(({ kind, isPrimary }) => kind === "phone" && isPrimary)?.value
      ?? contact.methods.find(({ kind }) => kind === "phone")?.value
      ?? "",
    contact.methods.find(({ kind, isPrimary }) => kind === "website" && isPrimary)?.value
      ?? contact.methods.find(({ kind }) => kind === "website")?.value
      ?? "",
    contact.tags.join("; "),
    contact.notes,
    contact.status,
  ]);
  return [columns, ...rows].map((row) => row.map((value) => csvCell(String(value))).join(",")).join("\r\n");
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted && character === "\"" && csv[index + 1] === "\"") {
      cell += "\"";
      index += 1;
    } else if (character === "\"") {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const csvRoleAliases: Record<string, ContactRole> = {
  crew: "crew",
  employee: "crew",
  employees: "crew",
  sub: "subcontractor",
  subs: "subcontractor",
  subcontractor: "subcontractor",
  subcontractors: "subcontractor",
  customer: "customer",
  customers: "customer",
  client: "customer",
  clients: "customer",
  supplier: "supplier",
  suppliers: "supplier",
  vendor: "supplier",
  vendors: "supplier",
  other: "other",
};

export function parseContactsCsv(csv: string): { contacts: ContactInput[]; skipped: number } {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) return { contacts: [], skipped: Math.max(0, rows.length - 1) };
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const nameIndex = indexOf("name", "contact name", "contact");
  const companyIndex = indexOf("company", "business");
  const rolesIndex = indexOf("roles", "role", "type");
  const emailIndex = indexOf("email", "email address");
  const phoneIndex = indexOf("phone", "phone number", "mobile");
  const websiteIndex = indexOf("website", "url");
  const tagsIndex = indexOf("tags", "tag");
  const notesIndex = indexOf("notes", "note");
  const statusIndex = indexOf("status");
  const contacts: ContactInput[] = [];
  let skipped = 0;
  for (const row of rows.slice(1, 501)) {
    const company = companyIndex >= 0 ? row[companyIndex]?.trim() ?? "" : "";
    const name = nameIndex >= 0 ? row[nameIndex]?.trim() ?? "" : "";
    if (!name && !company) {
      skipped += 1;
      continue;
    }
    const roleTokens = rolesIndex >= 0
      ? (row[rolesIndex] ?? "").split(/[;|]/).map((value) => value.trim().toLowerCase()).filter(Boolean)
      : [];
    const roles = [...new Set(roleTokens.map((value) => csvRoleAliases[value]).filter(Boolean))]
      .map((role) => ({ role, status: "active" as const, details: {} }));
    const methods: ContactMethod[] = [];
    const email = emailIndex >= 0 ? row[emailIndex]?.trim() ?? "" : "";
    const phone = phoneIndex >= 0 ? row[phoneIndex]?.trim() ?? "" : "";
    const website = websiteIndex >= 0 ? row[websiteIndex]?.trim() ?? "" : "";
    if (email) methods.push({ kind: "email", label: "", value: email, isPrimary: true });
    if (phone) methods.push({ kind: "phone", label: "", value: phone, isPrimary: true });
    if (website) methods.push({ kind: "website", label: "", value: website, isPrimary: true });
    contacts.push({
      entityType: company && !name ? "company" : "person",
      name: name || company,
      company,
      notes: notesIndex >= 0 ? row[notesIndex]?.trim() ?? "" : "",
      favorite: false,
      status: statusIndex >= 0 && row[statusIndex]?.trim().toLowerCase() === "archived"
        ? "archived"
        : "active",
      roles: roles.length ? roles : [{ role: "other", status: "active", details: {} }],
      methods,
      addresses: [],
      tags: tagsIndex >= 0
        ? [...new Set((row[tagsIndex] ?? "").split(/[;|]/).map((value) => value.trim().toLowerCase()).filter(Boolean))]
        : [],
    });
  }
  return { contacts, skipped: skipped + Math.max(0, rows.length - 501) };
}

export function contactDisplayName(contact: Pick<ContactRecord, "name" | "company">) {
  return contact.company.trim() || contact.name.trim();
}

export function contactMethodValue(
  contact: Pick<ContactRecord, "methods">,
  kind: ContactMethodKind,
) {
  return contact.methods.find((method) => method.kind === kind && method.isPrimary)?.value
    ?? contact.methods.find((method) => method.kind === kind)?.value
    ?? "";
}

export function contactAddressValue(
  contact: Pick<ContactRecord, "addresses">,
  kind: ContactAddressKind,
) {
  return contact.addresses.find((address) => address.kind === kind && address.isPrimary)?.address
    ?? contact.addresses.find((address) => address.kind === kind)?.address
    ?? "";
}
