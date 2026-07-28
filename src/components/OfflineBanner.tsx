import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudUpload, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { useOfflineQueue } from "../lib/OfflineQueueProvider";
import "./OfflineBanner.css";

export function OfflineBanner() {
  const { online, operations, syncing, retry, discard } = useOfflineQueue();
  const [showOnline, setShowOnline] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failed = operations.filter((operation) => operation.status === "failed" || operation.status === "conflicted");
  const waiting = operations.filter((operation) => operation.status === "queued" || operation.status === "syncing");

  useEffect(() => {
    function handleOffline() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setShowOnline(false);
    }

    function handleOnline() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setShowOnline(true);
      hideTimer.current = setTimeout(() => setShowOnline(false), 2500);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (online && !operations.length && !showOnline) return null;

  const stateClass = !online ? "is-offline" : failed.length ? "is-attention" : "is-online";
  const headline = !online
    ? waiting.length
      ? `${waiting.length} field ${waiting.length === 1 ? "item is" : "items are"} saved on this device.`
      : "You're offline. Supported field work can be saved on this device."
    : failed.length
      ? `${failed.length} saved ${failed.length === 1 ? "item needs" : "items need"} attention.`
      : operations.length
        ? syncing
          ? `Syncing ${operations.length} saved ${operations.length === 1 ? "item" : "items"}…`
          : `${operations.length} saved ${operations.length === 1 ? "item is" : "items are"} waiting to sync.`
        : "Back online. Account sync and delivery are available.";

  return (
    <aside className={`rivt-offline-banner ${stateClass}`} aria-label="Offline and sync status">
      <div className="rivt-offline-banner-summary" role="status" aria-live="polite">
        {!online
          ? <WifiOff size={17} aria-hidden="true" />
          : failed.length
            ? <AlertTriangle size={17} aria-hidden="true" />
            : operations.length
              ? <CloudUpload size={17} aria-hidden="true" />
              : <CheckCircle2 size={17} aria-hidden="true" />}
        <span>
          <strong>{headline}</strong>
          {!online
            ? <small>Sends, approvals, payments, messages, and public changes still need a connection.</small>
            : null}
        </span>
        {online && operations.length ? (
          <button type="button" onClick={() => void retry()} disabled={syncing} aria-label="Retry all saved items">
            <RefreshCw size={15} aria-hidden="true" className={syncing ? "is-spinning" : ""} />
            <span>{syncing ? "Syncing" : "Retry"}</span>
          </button>
        ) : null}
      </div>

      {operations.length ? (
        <details className="rivt-offline-queue">
          <summary>Review saved work ({operations.length})</summary>
          <ul>
            {operations.map((operation) => (
              <li key={operation.id}>
                <span>
                  <strong>{operation.label}</strong>
                  <small>
                    {operation.destinationLabel} · {operation.status === "conflicted" ? "Needs review" : operation.status}
                  </small>
                  {operation.lastError ? <small className="is-error">{operation.lastError}</small> : null}
                </span>
                <span className="rivt-offline-queue-actions">
                  {online && operation.status !== "syncing" ? (
                    <button type="button" onClick={() => void retry(operation.id)} aria-label={`Retry ${operation.label}`}>
                      <RefreshCw size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void discard(operation.id)} aria-label={`Discard device copy of ${operation.label}`}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </aside>
  );
}
