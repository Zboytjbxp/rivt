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
