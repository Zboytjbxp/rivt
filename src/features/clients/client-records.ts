import {
  apiPath,
  fetchWithTimeout,
  notifySessionExpired,
  requestKey,
} from "../../lib/api";

export const CLIENT_RECORDS_KEY = "rivt.clients.v1";

export type CustomerContactMethod = "none" | "email" | "phone" | "sms";
export type CustomerStatus = "active" | "archived";

export interface ClientRecord {
  id: string;
  legacyLocalId?: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  billingAddress: string;
  serviceAddress: string;
  notes: string;
  preferredContactMethod: CustomerContactMethod;
  defaultTerms: string;
  favorite: boolean;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  threadMessages?: ClientRecordMessage[];
}

export interface ClientRecordMessage {
  id: string;
  text: string;
  sentAt: string;
  from: "me";
}

export interface CustomerSnapshot {
  customerId: string;
  displayName: string;
  contactName: string;
  company: string;
  email: string;
  phone: string;
  billingAddress: string;
  serviceAddress: string;
  defaultTerms: string;
}

export interface CustomerActivity {
  id: string;
  kind: "document" | "project";
  title: string;
  status: string;
  date: string | null;
  amountCents: number | null;
  recordType: string | null;
  localId: string | null;
}

export interface ClientRecordSyncResult {
  clients: ClientRecord[];
  message: string;
}

function normalizeClientRecordMessage(value: unknown): ClientRecordMessage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ClientRecordMessage> & { from?: string };
  if (typeof candidate.id !== "string" || typeof candidate.text !== "string" || typeof candidate.sentAt !== "string") return null;
  if (candidate.from !== "me") return null;
  return {
    id: candidate.id,
    text: candidate.text,
    sentAt: candidate.sentAt,
    from: "me",
  };
}

function normalizeClientRecord(value: unknown): ClientRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ClientRecord>;
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || !candidate.name.trim()) return null;
  const createdAt = typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString();
  return {
    id: candidate.id,
    legacyLocalId: typeof candidate.legacyLocalId === "string" ? candidate.legacyLocalId : undefined,
    name: candidate.name.trim(),
    company: typeof candidate.company === "string" ? candidate.company : "",
    phone: typeof candidate.phone === "string" ? candidate.phone : "",
    email: typeof candidate.email === "string" ? candidate.email.toLowerCase() : "",
    billingAddress: typeof candidate.billingAddress === "string" ? candidate.billingAddress : "",
    serviceAddress: typeof candidate.serviceAddress === "string" ? candidate.serviceAddress : "",
    notes: typeof candidate.notes === "string" ? candidate.notes : "",
    preferredContactMethod: ["email", "phone", "sms"].includes(candidate.preferredContactMethod ?? "")
      ? candidate.preferredContactMethod as CustomerContactMethod
      : "none",
    defaultTerms: typeof candidate.defaultTerms === "string" ? candidate.defaultTerms : "",
    favorite: candidate.favorite === true,
    status: candidate.status === "archived" ? "archived" : "active",
    createdAt,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : createdAt,
    lastUsedAt: typeof candidate.lastUsedAt === "string" ? candidate.lastUsedAt : null,
    threadMessages: Array.isArray(candidate.threadMessages)
      ? candidate.threadMessages.map(normalizeClientRecordMessage).filter((message): message is ClientRecordMessage => Boolean(message)).slice(-100)
      : [],
  };
}

export function emptyClientRecord(name = ""): ClientRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    company: "",
    phone: "",
    email: "",
    billingAddress: "",
    serviceAddress: "",
    notes: "",
    preferredContactMethod: "none",
    defaultTerms: "",
    favorite: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    threadMessages: [],
  };
}

export function customerDisplayName(customer: Pick<ClientRecord, "name" | "company">) {
  return customer.company.trim() || customer.name.trim();
}

export function customerSnapshot(customer: ClientRecord): CustomerSnapshot {
  return {
    customerId: customer.id,
    displayName: customerDisplayName(customer),
    contactName: customer.name,
    company: customer.company,
    email: customer.email,
    phone: customer.phone,
    billingAddress: customer.billingAddress,
    serviceAddress: customer.serviceAddress,
    defaultTerms: customer.defaultTerms,
  };
}

export function readClientRecordsLocal(): ClientRecord[] {
  try {
    const raw = localStorage.getItem(CLIENT_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeClientRecord).filter((client): client is ClientRecord => Boolean(client));
  } catch {
    return [];
  }
}

export function saveClientRecordsLocal(clients: ClientRecord[]) {
  try {
    localStorage.setItem(CLIENT_RECORDS_KEY, JSON.stringify(clients));
  } catch {
    // Device caching is best-effort; the customer API remains canonical when available.
  }
}

function customerBody(customer: ClientRecord) {
  return {
    name: customer.name.trim(),
    company: customer.company.trim(),
    email: customer.email.trim().toLowerCase(),
    phone: customer.phone.trim(),
    billingAddress: customer.billingAddress.trim(),
    serviceAddress: customer.serviceAddress.trim(),
    notes: customer.notes.trim(),
    preferredContactMethod: customer.preferredContactMethod,
    defaultTerms: customer.defaultTerms.trim(),
    favorite: customer.favorite,
    status: customer.status,
    threadMessages: (customer.threadMessages ?? []).slice(-100),
  };
}

async function customerRequest(
  path: string,
  options: RequestInit = {},
): Promise<{ customer?: ClientRecord; customers?: ClientRecord[]; activity?: CustomerActivity[] } | null> {
  try {
    const response = await fetchWithTimeout(apiPath(path), {
      credentials: "include",
      ...options,
    });
    if (response.status === 401) notifySessionExpired();
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as {
      data?: { customer?: unknown; customers?: unknown[]; activity?: CustomerActivity[] };
    } | null;
    return {
      customer: normalizeClientRecord(body?.data?.customer) ?? undefined,
      customers: Array.isArray(body?.data?.customers)
        ? body!.data!.customers!.map(normalizeClientRecord).filter((customer): customer is ClientRecord => Boolean(customer))
        : undefined,
      activity: Array.isArray(body?.data?.activity) ? body!.data!.activity : undefined,
    };
  } catch {
    return null;
  }
}

async function createOrImportClientRecord(customer: ClientRecord): Promise<ClientRecord | null> {
  const result = await customerRequest("/api/v1/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": requestKey(),
    },
    body: JSON.stringify({
      ...customerBody(customer),
      localId: customer.legacyLocalId ?? customer.id,
    }),
  });
  return result?.customer ?? null;
}

export async function saveClientRecord(customer: ClientRecord): Promise<ClientRecord | null> {
  const canonical = customer.legacyLocalId
    ? await customerRequest(`/api/v1/customers/${encodeURIComponent(customer.id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey(),
        },
        body: JSON.stringify(customerBody({ ...customer, updatedAt: new Date().toISOString() })),
      }).then((result) => result?.customer ?? null)
    : null;
  return canonical ?? createOrImportClientRecord(customer);
}

export async function syncClientRecords(): Promise<ClientRecordSyncResult> {
  const localSnapshot = readClientRecordsLocal();
  const response = await customerRequest("/api/v1/customers?status=active&limit=200");
  if (!response?.customers) {
    return {
      clients: localSnapshot.filter((customer) => customer.status === "active"),
      message: "Saved on this device. Sign in with network access to sync.",
    };
  }

  const serverCustomers = response.customers;
  const serverIds = new Set(serverCustomers.flatMap((customer) => [customer.id, customer.legacyLocalId].filter(Boolean) as string[]));
  const localOnly = localSnapshot.filter((customer) =>
    customer.status === "active"
    && !serverIds.has(customer.id)
    && !(customer.legacyLocalId && serverIds.has(customer.legacyLocalId))
  );
  const imported = (await Promise.all(localOnly.map(createOrImportClientRecord)))
    .filter((customer): customer is ClientRecord => Boolean(customer));
  const importedLocalIds = new Set(imported.flatMap((customer) => [customer.id, customer.legacyLocalId].filter(Boolean) as string[]));
  const unsynced = localOnly.filter((customer) =>
    !importedLocalIds.has(customer.id)
    && !(customer.legacyLocalId && importedLocalIds.has(customer.legacyLocalId))
  );
  const merged = [...serverCustomers, ...imported, ...unsynced]
    .filter((customer, index, all) => all.findIndex((candidate) => candidate.id === customer.id) === index)
    .sort((left, right) => {
      if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
      return new Date(right.lastUsedAt ?? right.updatedAt).getTime() - new Date(left.lastUsedAt ?? left.updatedAt).getTime();
    });
  saveClientRecordsLocal(merged);
  return {
    clients: merged,
    message: unsynced.length
      ? `${merged.length - unsynced.length} customers synced. ${unsynced.length} still saved on this device.`
      : "Customers synced to your RIVT account.",
  };
}

export async function fetchAllClientRecords(): Promise<ClientRecord[] | null> {
  const response = await customerRequest("/api/v1/customers?status=all&limit=200");
  if (!response?.customers) return null;
  const customers = response.customers.sort((left, right) => {
    if (left.status !== right.status) return left.status === "active" ? -1 : 1;
    if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
    return new Date(right.lastUsedAt ?? right.updatedAt).getTime()
      - new Date(left.lastUsedAt ?? left.updatedAt).getTime();
  });
  saveClientRecordsLocal(customers);
  return customers;
}

export async function upsertClientRecord(client: ClientRecord): Promise<boolean> {
  const saved = await saveClientRecord(client);
  return Boolean(saved);
}

export async function deleteClientRecord(clientId: string): Promise<boolean> {
  const customer = readClientRecordsLocal().find((candidate) => candidate.id === clientId);
  if (!customer) return true;
  const archived = await saveClientRecord({
    ...customer,
    status: "archived",
    updatedAt: new Date().toISOString(),
  });
  return Boolean(archived);
}

export async function markClientRecordUsed(customer: ClientRecord): Promise<ClientRecord | null> {
  if (!customer.legacyLocalId) return saveClientRecord({ ...customer, lastUsedAt: new Date().toISOString() });
  const result = await customerRequest(`/api/v1/customers/${encodeURIComponent(customer.id)}/used`, {
    method: "POST",
    headers: { "Idempotency-Key": requestKey() },
  });
  return result?.customer ?? null;
}

export async function fetchCustomerActivity(customerId: string): Promise<CustomerActivity[] | null> {
  const result = await customerRequest(`/api/v1/customers/${encodeURIComponent(customerId)}/activity`);
  return result?.activity ?? null;
}
