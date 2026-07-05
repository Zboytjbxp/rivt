import { Clock, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Job } from "../../types";
import { EmptyState, Panel } from "../../components/ui";
import { usePro } from "../pro/usePro";
import { UpgradeModal } from "../pro/UpgradeModal";
import { deleteToolRecordByLocalId, fetchToolRecords, upsertToolRecord, type ServerToolRecord } from "./tool-records-api";

const timeTrackerKey = "rivt.timeSessions.v1";

interface TimeSession {
  id: string;
  jobId: number | null;
  jobTitle: string;
  startedAt: string;
  endedAt: string | null;
  notes: string;
}

function formatNumber(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function formatHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
}

function readTimeSessions(): TimeSession[] {
  try {
    const stored = localStorage.getItem(timeTrackerKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as TimeSession[];
    return Array.isArray(parsed) ? parsed.slice(0, 100) : [];
  } catch {
    return [];
  }
}

function persistTimeSessions(sessions: TimeSession[]) {
  try {
    localStorage.setItem(timeTrackerKey, JSON.stringify(sessions.slice(0, 100)));
  } catch {
    // Local persistence is best-effort for this standalone field utility.
  }
}

function isTimeSession(value: unknown): value is TimeSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TimeSession>;
  return typeof candidate.id === "string"
    && (candidate.jobId === null || typeof candidate.jobId === "number")
    && typeof candidate.jobTitle === "string"
    && typeof candidate.startedAt === "string"
    && (candidate.endedAt === null || typeof candidate.endedAt === "string")
    && typeof candidate.notes === "string";
}

function timeSessionFromServer(record: ServerToolRecord): TimeSession | null {
  if (!isTimeSession(record.payload)) return null;
  return {
    ...record.payload,
    id: record.localId,
    jobTitle: record.payload.jobTitle || record.title,
  };
}

function timeSessionToServerInput(session: TimeSession) {
  return {
    recordType: "time_session" as const,
    localId: session.id,
    title: session.jobTitle || "Standalone time session",
    status: session.endedAt ? "complete" : "running",
    recordDate: session.startedAt.slice(0, 10),
    amountCents: null,
    payload: { ...session },
  };
}

export function TimeTrackerTool({ activeJob, jobs }: { activeJob: Job | null; jobs: Job[] }) {
  const { isPro } = usePro();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [sessions, setSessions] = useState<TimeSession[]>(readTimeSessions);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const [running, setRunning] = useState<TimeSession | null>(
    () => readTimeSessions().find((s) => !s.endedAt) ?? null,
  );
  const [elapsed, setElapsed] = useState(0);
  const [jobId, setJobId] = useState<number | null>(activeJob?.id ?? null);
  const [clockNotes, setClockNotes] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("time_session").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Saved on this device. Sign in with network access to sync.");
        return;
      }
      const mapped = serverRecords.map(timeSessionFromServer).filter((session): session is TimeSession => Boolean(session));
      if (mapped.length) {
        setSessions(mapped);
        setRunning(mapped.find((session) => !session.endedAt) ?? null);
        persistTimeSessions(mapped);
        setSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localSnapshot = readTimeSessions();
      if (localSnapshot.length) {
        void Promise.all(localSnapshot.map((session) => upsertToolRecord(timeSessionToServerInput(session)))).then((results) => {
          setSyncMessage(results.some(Boolean)
            ? "Local time sessions synced to your RIVT account."
            : "Couldn't sync - saved on this device only.");
        });
        return;
      }
      setSyncMessage("New time sessions sync to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, []);

  function persistSessions(next: TimeSession[], changedSession?: TimeSession) {
    setSessions(next);
    persistTimeSessions(next);
    if (!changedSession) return;
    void upsertToolRecord(timeSessionToServerInput(changedSession)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!running) { setElapsed(0); return; }
    const start = new Date(running.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);

  function clockIn() {
    if (running) return;
    const job = jobs.find((j) => j.id === jobId) ?? null;
    const session: TimeSession = {
      id: crypto.randomUUID(),
      jobId: job?.id ?? null,
      jobTitle: job?.title ?? "Standalone",
      startedAt: new Date().toISOString(),
      endedAt: null,
      notes: "",
    };
    const next = [session, ...sessions];
    persistSessions(next, session);
    setRunning(session);
  }

  function clockOut() {
    if (!running) return;
    const ended: TimeSession = { ...running, endedAt: new Date().toISOString(), notes: clockNotes.trim() };
    const next = sessions.map((s) => s.id === running.id ? ended : s);
    persistSessions(next, ended);
    setRunning(null);
    setClockNotes("");
  }

  function deleteSession(sessionId: string) {
    const next = sessions.filter((s) => s.id !== sessionId);
    setSessions(next);
    if (running?.id === sessionId) setRunning(null);
    persistTimeSessions(next);
    void deleteToolRecordByLocalId("time_session", sessionId).then((ok) => {
      setSyncMessage(ok ? "Deleted from this device and your RIVT account." : "Deleted on this device only. Could not sync deletion.");
    });
  }

  function hoursFor(s: TimeSession): number {
    // eslint-disable-next-line react-hooks/purity
    const end = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
    return (end - new Date(s.startedAt).getTime()) / 3600000;
  }

  // eslint-disable-next-line react-hooks/purity
  const cutoffDate = isPro ? null : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const visibleSessions = cutoffDate ? sessions.filter(s => s.startedAt >= cutoffDate) : sessions;
  const completed = visibleSessions.filter((s) => s.endedAt);
  const totalHours = completed.reduce((sum, s) => sum + hoursFor(s), 0);

  const last7Days = getLast7Days();
  const today = new Date().toISOString().slice(0, 10);
  const hoursPerDay: Record<string, number> = {};
  for (const day of last7Days) {
    hoursPerDay[day] = completed
      .filter((s) => s.startedAt.slice(0, 10) === day)
      .reduce((sum, s) => sum + hoursFor(s), 0);
  }
  const maxH = Math.max(...Object.values(hoursPerDay), 1);

  return (
    <div className="v2-tool-workbench">
      <Panel className="v2-tool-panel" eyebrow="Time tracker" title="Clock in / clock out">
        <div className="v2-tool-input-grid">
          <label className="is-wide">Job
            <select value={jobId ?? ""} onChange={(e) => setJobId(Number(e.target.value) || null)} disabled={!!running}>
              <option value="">Standalone / no job</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </label>
        </div>
        <div className="v2-time-clock">
          {running ? (
            <>
              <span className="v2-time-clock-label">Clocked in - {running.jobTitle}</span>
              <strong className="v2-time-clock-display">{formatHms(elapsed)}</strong>
              <label>Notes<textarea value={clockNotes} onChange={(e) => setClockNotes(e.target.value)} rows={2} placeholder="What are you working on?" /></label>
              <button type="button" className="v2-destructive-button" onClick={clockOut}>Clock out</button>
            </>
          ) : (
            <>
              <span className="v2-time-clock-label">Ready to clock in</span>
              <strong className="v2-time-clock-display">00:00:00</strong>
              <button type="button" className="v2-primary-button" onClick={clockIn}>Clock in</button>
            </>
          )}
        </div>
        <p className="v2-record-notice" role="status">{syncMessage}</p>
      </Panel>
      <Panel className="v2-tool-panel" eyebrow={`${completed.length} sessions`} title={`${formatNumber(totalHours, 1)} total hours`}>
        <div className="v2-tt-weekly-chart">
          <header><span>This week</span></header>
          <svg viewBox="0 0 280 90" aria-hidden="true">
            {last7Days.map((day, i) => {
              const h = hoursPerDay[day] ?? 0;
              const barH = Math.max(2, (h / maxH) * 60);
              const x = 20 + i * 38;
              const isToday = day === today;
              return (
                <g key={day}>
                  <rect x={x} y={88 - barH} width={26} height={barH}
                    fill={isToday ? "var(--v2-accent)" : "var(--v2-surface-muted)"}
                    stroke="var(--v2-border)" strokeWidth="1" rx="3" />
                  <text x={x + 13} y={85} textAnchor="middle" fontSize="9" fill="var(--v2-text-muted)">
                    {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"][i]}
                  </text>
                  {h > 0 && <text x={x + 13} y={83 - barH} textAnchor="middle" fontSize="8" fill="var(--v2-text-muted)">{h.toFixed(1)}</text>}
                </g>
              );
            })}
          </svg>
        </div>
        {!isPro && sessions.length > visibleSessions.length && (
          <p className="v2-tool-note" style={{ fontSize: 12 }}>
            Showing 90-day history. <button type="button" style={{ background: "none", border: "none", color: "var(--v2-accent)", cursor: "pointer", padding: 0, fontSize: 12, textDecoration: "underline" }} onClick={() => setUpgradeOpen(true)}>Upgrade for full history</button>
          </p>
        )}
        {completed.length ? (
          <div className="v2-time-session-list">
            {completed.slice(0, 15).map((s) => (
              <article key={s.id} className="v2-time-session">
                <div>
                  <strong>{s.jobTitle}</strong>
                  <small>{new Date(s.startedAt).toLocaleDateString()} - {formatNumber(hoursFor(s), 1)}h</small>
                  {s.notes ? <span>{s.notes}</span> : null}
                </div>
                <button type="button" aria-label="Delete session" onClick={() => deleteSession(s.id)}><Trash2 size={13} /></button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState className="v2-tools-empty" icon={<Clock size={20} />} title="No sessions yet" description="Clock in to start tracking time against a job." compact />
        )}
      </Panel>
      {upgradeOpen && <UpgradeModal reason="Full time-history access" onClose={() => setUpgradeOpen(false)} />}
    </div>
  );
}
