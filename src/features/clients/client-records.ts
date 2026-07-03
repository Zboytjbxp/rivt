import {
  deleteToolRecordByLocalId,
  fetchToolRecords,
  upsertToolRecord,
  type ServerToolRecord,
  type ToolRecordInput,
} from "../tools/tool-records-api";

export const CLIENT_RECORDS_KEY = "rivt.clients.v1";

export interface ClientRecord {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
}

export interface ClientRecordSyncResult {
  clients: ClientRecord[];
  message: string;
}

function normalizeClientRecord(value: unknown): ClientRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ClientRecord>;
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || !candidate.name.trim()) return null;
  return {
    id: candidate.id,
    name: candidate.name.trim(),
    company: typeof candidate.company === "string" ? candidate.company : "",
    phone: typeof candidate.phone === "string" ? candidate.phone : "",
    email: typeof candidate.email === "string" ? candidate.email : "",
    notes: typeof candidate.notes === "string" ? candidate.notes : "",
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
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
    // Local persistence is best-effort; server sync still runs when available.
  }
}

export function clientRecordFromServer(record: ServerToolRecord): ClientRecord | null {
  const client = normalizeClientRecord(record.payload);
  if (!client) return null;
  return {
    ...client,
    id: record.localId || client.id,
    createdAt: client.createdAt || record.createdAt || new Date().toISOString(),
  };
}

export function clientRecordToServerInput(client: ClientRecord): ToolRecordInput {
  const title = client.company ? `${client.name} - ${client.company}` : client.name;
  return {
    recordType: "client",
    localId: client.id,
    title,
    status: "active",
    recordDate: client.createdAt.slice(0, 10),
    amountCents: null,
    payload: { ...client } as Record<string, unknown>,
  };
}

export async function syncClientRecords(): Promise<ClientRecordSyncResult> {
  const serverRecords = await fetchToolRecords("client");
  const localSnapshot = readClientRecordsLocal();

  if (!serverRecords) {
    return {
      clients: localSnapshot,
      message: "Saved on this device. Sign in with network access to sync.",
    };
  }

  const serverClients = serverRecords
    .map(clientRecordFromServer)
    .filter((client): client is ClientRecord => Boolean(client));

  if (serverClients.length) {
    saveClientRecordsLocal(serverClients);
    return { clients: serverClients, message: "Synced to your RIVT account." };
  }

  if (localSnapshot.length) {
    const results = await Promise.all(localSnapshot.map((client) => upsertToolRecord(clientRecordToServerInput(client))));
    return {
      clients: localSnapshot,
      message: results.some(Boolean)
        ? "Local client records synced to your RIVT account."
        : "Saved on this device. Sync will retry when your account is reachable.",
    };
  }

  return { clients: [], message: "New client records sync to your RIVT account." };
}

export async function upsertClientRecord(client: ClientRecord): Promise<boolean> {
  const record = await upsertToolRecord(clientRecordToServerInput(client));
  return Boolean(record);
}

export function deleteClientRecord(clientId: string): Promise<boolean> {
  return deleteToolRecordByLocalId("client", clientId);
}
