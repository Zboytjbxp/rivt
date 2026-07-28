import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  OFFLINE_QUEUE_CHANGED_EVENT,
  flushOfflineQueue,
  listOfflineOperations,
  removeOfflineOperation,
  retryOfflineOperation,
  type OfflineOperation,
} from "./offline-queue";

interface OfflineQueueContextValue {
  accountId: string;
  online: boolean;
  operations: OfflineOperation[];
  syncing: boolean;
  refresh: () => Promise<void>;
  retry: (id?: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);

export function OfflineQueueProvider({
  accountId,
  children,
}: {
  accountId: string;
  children: ReactNode;
}) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setOperations(await listOfflineOperations(accountId));
  }, [accountId]);

  const flush = useCallback(async (force = false) => {
    if (!navigator.onLine) {
      await refresh();
      return;
    }
    setSyncing(true);
    try {
      await flushOfflineQueue(accountId, { force });
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [accountId, refresh]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await listOfflineOperations(accountId);
      if (!cancelled) setOperations(next);
    };
    const handleChanged = () => { void load(); };
    const handleOnline = () => {
      setOnline(true);
      void flush();
    };
    const handleOffline = () => {
      setOnline(false);
      void load();
    };
    void load().then(() => {
      if (navigator.onLine) void flush();
    });
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleChanged);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleChanged);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [accountId, flush]);

  const value = useMemo<OfflineQueueContextValue>(() => ({
    accountId,
    online,
    operations,
    syncing,
    refresh,
    retry: async (id) => {
      if (id) await retryOfflineOperation(id, accountId);
      else await flush(true);
      await refresh();
    },
    discard: async (id) => {
      const owned = operations.some((operation) => operation.id === id && operation.accountId === accountId);
      if (!owned) return;
      await removeOfflineOperation(id);
      await refresh();
    },
  }), [accountId, flush, online, operations, refresh, syncing]);

  return <OfflineQueueContext.Provider value={value}>{children}</OfflineQueueContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOfflineQueue() {
  const value = useContext(OfflineQueueContext);
  if (!value) throw new Error("useOfflineQueue must be used inside OfflineQueueProvider.");
  return value;
}
