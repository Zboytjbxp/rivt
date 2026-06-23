export function recordServerEvent(type: string, payload: Record<string, unknown>) {
  void type;
  void payload;
  // The legacy generic event bridge is retired. Canonical workflows write
  // auditable events through their dedicated server APIs.
}

export function currentTimeLabel() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

export function idempotencyKey(scope: string) {
  const randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${scope}-${randomPart}`;
}
