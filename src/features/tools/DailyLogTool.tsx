import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CloudSun, Copy, Download, FileText, FolderOpen, RefreshCw } from "lucide-react";
import type { Job } from "../../types";
import { Panel } from "../../components/ui";
import type { CanonicalActiveWork } from "../work/job-api";
import { addProjectNote, openProjectForActiveWork, ProjectApiError } from "./project-api";
import { fetchToolRecords, upsertToolRecord, type ServerToolRecord } from "./tool-records-api";

function formatNumber(value: number, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0";
}

function projectErrorMessage(error: unknown) {
  if (error instanceof ProjectApiError) return error.message;
  return error instanceof Error ? error.message : "RIVT could not complete the Records request.";
}
const dailyLogStorageKey = "rivt.dailyLogDraft.v1";
const dailyLogDraftRecordId = "daily-log-draft";
const dailyLogChecklist = [
  "Photos captured",
  "Scope change noted",
  "Safety condition checked",
  "Materials staged",
  "Contractor/customer updated",
] as const;

type DailyLogChecklistItem = (typeof dailyLogChecklist)[number];

interface DailyLogDraft {
  date: string;
  site: string;
  trade: string;
  weather: string;
  crewCount: number;
  hours: number;
  completed: string;
  blockers: string;
  materials: string;
  safety: string;
  nextStep: string;
  checklist: Record<DailyLogChecklistItem, boolean>;
}

function isDailyLogDraft(value: unknown): value is DailyLogDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DailyLogDraft>;
  return typeof candidate.date === "string"
    && typeof candidate.site === "string"
    && typeof candidate.trade === "string"
    && typeof candidate.weather === "string"
    && typeof candidate.crewCount === "number"
    && typeof candidate.hours === "number"
    && typeof candidate.completed === "string"
    && typeof candidate.blockers === "string"
    && typeof candidate.materials === "string"
    && typeof candidate.safety === "string"
    && typeof candidate.nextStep === "string"
    && typeof candidate.checklist === "object"
    && candidate.checklist !== null;
}

function dailyLogDraftFromServer(record: ServerToolRecord, fallback: DailyLogDraft): DailyLogDraft | null {
  if (record.localId !== dailyLogDraftRecordId || record.status !== "draft" || !isDailyLogDraft(record.payload)) return null;
  return {
    ...fallback,
    ...record.payload,
    checklist: { ...fallback.checklist, ...record.payload.checklist },
  };
}

function dailyLogDraftToServerInput(draft: DailyLogDraft) {
  return {
    recordType: "daily_report" as const,
    localId: dailyLogDraftRecordId,
    title: draft.site || "Daily log draft",
    status: "draft",
    recordDate: draft.date || null,
    amountCents: null,
    payload: { ...draft },
  };
}

function defaultDailyLogDraft(activeJob: Job | null): DailyLogDraft {
  return {
    date: new Date().toISOString().slice(0, 10),
    site: activeJob ? `${activeJob.title} - ${activeJob.location}` : "",
    trade: activeJob?.trade ?? "",
    weather: "",
    crewCount: 1,
    hours: activeJob?.durationHours ?? 8,
    completed: "",
    blockers: "",
    materials: "",
    safety: "",
    nextStep: "",
    checklist: dailyLogChecklist.reduce((items, label) => ({ ...items, [label]: false }), {} as Record<DailyLogChecklistItem, boolean>),
  };
}

export function DailyLogTool({ activeJob, activeWork }: { activeJob: Job | null; activeWork: CanonicalActiveWork[] }) {
  const [draft, setDraft] = useState<DailyLogDraft>(() => defaultDailyLogDraft(activeJob));
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [syncMessage, setSyncMessage] = useState("Draft saved on this device.");
  const [savingRecord, setSavingRecord] = useState(false);
  const [wxData, setWxData] = useState<{ temp: number; condition: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem("rivt.lastWeather.v1") ?? "null") as { temp: number; condition: string } | null; } catch { return null; }
  });

  useEffect(() => {
    let cancelled = false;
    const fallback = defaultDailyLogDraft(activeJob);
    void fetchToolRecords("daily_report").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Draft saved on this device. Sign in with network access to sync.");
        return;
      }
      const serverDraft = serverRecords
        .map((record) => dailyLogDraftFromServer(record, fallback))
        .find((record): record is DailyLogDraft => Boolean(record));
      if (serverDraft) {
        setDraft(serverDraft);
        try { localStorage.setItem(dailyLogStorageKey, JSON.stringify(serverDraft)); } catch { /* noop */ }
        setSyncMessage("Draft synced to your RIVT account.");
        return;
      }
      try {
        const stored = localStorage.getItem(dailyLogStorageKey);
        if (!stored) {
          setSyncMessage("New drafts sync to your RIVT account.");
          return;
        }
        const parsed = JSON.parse(stored) as Partial<DailyLogDraft>;
        const localDraft = {
          ...fallback,
          ...parsed,
          checklist: { ...fallback.checklist, ...(parsed.checklist ?? {}) },
        };
        if (!isDailyLogDraft(localDraft)) {
          setSyncMessage("New drafts sync to your RIVT account.");
          return;
        }
        void upsertToolRecord(dailyLogDraftToServerInput(localDraft)).then((record) => {
          setSyncMessage(record ? "Local daily log draft synced to your RIVT account." : "Draft saved on this device. Sync will retry when your account is reachable.");
        });
      } catch {
        setSyncMessage("New drafts sync to your RIVT account.");
      }
    });
    return () => { cancelled = true; };
  }, [activeJob]);

  useEffect(() => {
    if (wxData) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true&temperature_unit=fahrenheit`)
        .then((r) => r.json())
        .then((data: { current_weather?: { temperature: number; weathercode: number } }) => {
          const cw = data.current_weather;
          if (!cw) return;
          const codes: Record<number, string> = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Foggy", 51: "Drizzle", 61: "Rain", 71: "Snow", 80: "Showers", 95: "Thunderstorm" };
          const condition = codes[cw.weathercode] ?? "Partly cloudy";
          const wx = { temp: Math.round(cw.temperature), condition };
          setWxData(wx);
          try { localStorage.setItem("rivt.lastWeather.v1", JSON.stringify(wx)); } catch { /* noop */ }
        }).catch(() => { /* noop */ });
    }, () => {});
  }, [wxData]);

  const completedChecks = dailyLogChecklist.filter((item) => draft.checklist[item]).length;
  const recordWork = activeWork.find((work) => work.status === "active") ?? activeWork[0] ?? null;
  const recordWorkLabel = recordWork?.job?.title ?? activeJob?.title ?? "Accepted work";
  const dailyLogText = useMemo(() => [
    `RIVT daily log - ${draft.date || "undated"}`,
    `Site/job: ${draft.site || "Not entered"}`,
    `Trade: ${draft.trade || "Not entered"}`,
    `Weather: ${draft.weather || "Not entered"}`,
    `Crew: ${draft.crewCount || 0} person${draft.crewCount === 1 ? "" : "s"} / ${formatNumber(draft.hours)} hours`,
    "",
    "Work completed:",
    draft.completed || "Not entered",
    "",
    "Blockers / changes:",
    draft.blockers || "None entered",
    "",
    "Materials / equipment:",
    draft.materials || "Not entered",
    "",
    "Safety note:",
    draft.safety || "Not entered",
    "",
    "Next step:",
    draft.nextStep || "Not entered",
    "",
    "Checklist:",
    ...dailyLogChecklist.map((item) => `${draft.checklist[item] ? "[x]" : "[ ]"} ${item}`),
    "",
    "Standalone draft. Save official closeout evidence in RIVT Records for accepted work.",
  ].join("\n"), [draft]);

  function updateDraft<K extends keyof DailyLogDraft>(key: K, value: DailyLogDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  function toggleChecklist(item: DailyLogChecklistItem) {
    setDraft((current) => ({
      ...current,
      checklist: { ...current.checklist, [item]: !current.checklist[item] },
    }));
    setNotice("");
  }

  function saveLocalDraft() {
    try {
      localStorage.setItem(dailyLogStorageKey, JSON.stringify(draft));
      setNotice("Daily log draft saved.");
    } catch {
      setNotice("Daily log draft could not be saved on this device.");
      return;
    }
    void upsertToolRecord(dailyLogDraftToServerInput(draft)).then((record) => {
      setSyncMessage(record ? "Draft synced to your RIVT account." : "Draft saved on this device. Sync will retry when your account is reachable.");
    });
  }

  function loadLocalDraft() {
    try {
      const stored = localStorage.getItem(dailyLogStorageKey);
      if (!stored) {
        setNotice("No daily log draft found on this device.");
        return;
      }
      const parsed = JSON.parse(stored) as Partial<DailyLogDraft>;
      setDraft({
        ...defaultDailyLogDraft(activeJob),
        ...parsed,
        checklist: { ...defaultDailyLogDraft(activeJob).checklist, ...(parsed.checklist ?? {}) },
      });
      setNotice("Loaded the last daily log draft on this device.");
      setSyncMessage("Loaded the local backup draft.");
    } catch {
      setNotice("Daily log draft could not be loaded.");
    }
  }

  async function copyDailyLog() {
    try {
      await navigator.clipboard.writeText(dailyLogText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadDailyLog() {
    const blob = new Blob([dailyLogText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rivt-daily-log-${draft.date || "draft"}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  async function saveToRecords() {
    if (!recordWork) {
      setNotice("Accepted work is required before RIVT can save this daily log to server-backed Records.");
      return;
    }
    setSavingRecord(true);
    setNotice("");
    try {
      const project = await openProjectForActiveWork(recordWork.id);
      await addProjectNote(project.id, dailyLogText);
      setNotice("Daily log saved to the server-backed Records timeline.");
    } catch (error) {
      setNotice(projectErrorMessage(error));
    } finally {
      setSavingRecord(false);
    }
  }

  return (
    <div className="v2-tool-workbench v2-daily-log-workbench">
      <Panel className="v2-tool-panel" eyebrow="Daily log" title="Capture the jobsite while it is fresh">
        <div className="v2-tool-input-grid three">
          <label>Date<input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} /></label>
          <label>Trade<input value={draft.trade} onChange={(event) => updateDraft("trade", event.target.value)} placeholder="Electrical, HVAC, Carpentry..." /></label>
          <label>Weather
            <span className="v2-daily-log-weather-row">
              <input value={draft.weather} onChange={(event) => updateDraft("weather", event.target.value)} placeholder="Hot, rain delay, dry..." />
              <button
                type="button"
                className="v2-daily-log-wx-btn"
                title={wxData ? `Fill: ${wxData.temp}°F, ${wxData.condition}` : "Fetching weather…"}
                disabled={!wxData}
                onClick={() => {
                  if (!wxData) return;
                  updateDraft("weather", `${wxData.temp}°F, ${wxData.condition}`);
                }}
              >
                <CloudSun size={14} />
                Fill weather
              </button>
            </span>
          </label>
          <label>Site / job<input value={draft.site} onChange={(event) => updateDraft("site", event.target.value)} placeholder="Job name or address nickname" /></label>
          <label>Crew count<input type="number" min="0" value={draft.crewCount} onChange={(event) => updateDraft("crewCount", Math.max(0, Number(event.target.value) || 0))} /></label>
          <label>Hours<input type="number" min="0" step="0.5" value={draft.hours} onChange={(event) => updateDraft("hours", Math.max(0, Number(event.target.value) || 0))} /></label>
        </div>
        <div className="v2-daily-log-notes">
          <label>Work completed<textarea value={draft.completed} onChange={(event) => updateDraft("completed", event.target.value)} placeholder="What got done today? Include rough quantities, rooms, panels, fixtures, walls, or areas." rows={4} /></label>
          <label>Blockers / changes<textarea value={draft.blockers} onChange={(event) => updateDraft("blockers", event.target.value)} placeholder="Delays, missing material, access issues, scope changes, inspection items..." rows={3} /></label>
          <label>Materials / equipment<textarea value={draft.materials} onChange={(event) => updateDraft("materials", event.target.value)} placeholder="Material staged, returns needed, tools left on site, rental equipment..." rows={3} /></label>
          <label>Safety note<textarea value={draft.safety} onChange={(event) => updateDraft("safety", event.target.value)} placeholder="Hazards, PPE, lockout/tagout, ladder/scaffold note, heat plan..." rows={3} /></label>
          <label>Next step<textarea value={draft.nextStep} onChange={(event) => updateDraft("nextStep", event.target.value)} placeholder="What should happen next and who owns it?" rows={3} /></label>
        </div>
      </Panel>

      <aside className="v2-daily-log-side">
        <Panel className="v2-tool-panel v2-tool-summary-panel" eyebrow="Daily log" title="Preview">
          <div className="v2-tool-result-grid compact">
            <article><span>Crew hours</span><strong>{formatNumber(draft.crewCount * draft.hours)}h</strong></article>
            <article><span>Checklist</span><strong>{completedChecks}/{dailyLogChecklist.length}</strong></article>
            <article><span>Mode</span><strong>{recordWork ? "Records-ready" : "Draft"}</strong></article>
          </div>
          <div className={recordWork ? "v2-daily-log-record-target is-ready" : "v2-daily-log-record-target"}>
            <span>{recordWork ? "Accepted work target" : "No accepted work loaded"}</span>
            <strong>{recordWork ? recordWorkLabel : "Save draft or open Records after a hire"}</strong>
            <small>{recordWork ? "This log can be added to the private project timeline." : "Server-backed Records are available after a job is accepted by both sides."}</small>
          </div>
          <div className="v2-daily-log-checklist" aria-label="Daily log checklist">
            {dailyLogChecklist.map((item) => (
              <button key={item} type="button" className={draft.checklist[item] ? "active" : ""} aria-pressed={draft.checklist[item]} onClick={() => toggleChecklist(item)}>
                <CheckCircle2 size={15} />
                {item}
              </button>
            ))}
          </div>
          <pre className="v2-daily-log-preview">{dailyLogText}</pre>
          {notice ? <p className="v2-record-notice" role="status">{notice}</p> : null}
          <p className="v2-record-notice" role="status">{syncMessage}</p>
          <div className="v2-tool-action-row">
            <button type="button" className="v2-primary-button" onClick={() => void saveToRecords()} disabled={savingRecord || !recordWork}>
              <FolderOpen size={15} />
              {savingRecord ? "Saving" : "Save to Records"}
            </button>
            <button type="button" className="v2-primary-button" onClick={copyDailyLog}><Copy size={15} />{copied ? "Copied" : "Copy daily log"}</button>
            <button type="button" onClick={downloadDailyLog}><Download size={15} />{downloaded ? "Downloaded" : "Download TXT"}</button>
            <button type="button" onClick={saveLocalDraft}><FileText size={15} />Save draft</button>
            <button type="button" onClick={loadLocalDraft}><RefreshCw size={15} />Load last draft</button>
          </div>
          <p className="v2-tool-note">
            {recordWork
              ? "Save to Records writes a private project timeline note through RIVT's authenticated Records API. Draft sync, copy, and download remain available for field backup."
              : "Draft sync keeps this field note available through your RIVT account when signed in. Accepted-work closeouts, uploads, and official records stay in server-backed Records."}
          </p>
        </Panel>
      </aside>
    </div>
  );
}

