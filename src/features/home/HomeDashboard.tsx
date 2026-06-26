import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  CloudSun,
  FileText,
  MapPin,
  MessageSquareText,
  Navigation2,
  Newspaper,
  Plus,
  Target,
  Timer,
  Users,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Job, Role } from "../../types";
import type { PrimaryDestination } from "../../app-shell/types";
import { EmptyState, PageHeader } from "../../components/ui";
import "./home-dashboard.css";

type AvailDay = "available" | "limited" | "unavailable";
const WEEK_DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEK_DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const AVAIL_CYCLE: AvailDay[] = ["available", "limited", "unavailable"];
const AVAIL_DAY_LABEL: Record<AvailDay, string> = { available: "Open", limited: "Ltd", unavailable: "Off" };
const WEEKLY_AVAIL_KEY = "rivt.weeklyAvail.v1";
const TIME_SESSIONS_KEY = "rivt.timeSessions.v1";
const WEEKLY_GOAL_KEY = "rivt.weeklyGoal.v1";
const CHECKIN_LOG_KEY = "rivt.checkinLog.v1";

interface TimeSession {
  id: string;
  jobId: number | null;
  jobTitle: string;
  startedAt: string;
  endedAt: string | null;
  notes: string;
}

interface WeeklyGoal {
  target: number;
  hourlyRate: number;
}

interface CheckinEntry {
  id: string;
  timestamp: string;
  lat: number | null;
  lon: number | null;
  label: string;
}

interface WeatherSnapshot {
  temp: number;
  condition: string;
}

function readWeeklyAvailability(): Record<number, AvailDay> {
  try {
    const raw = localStorage.getItem(WEEKLY_AVAIL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, AvailDay>;
      return Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, parsed[i] ?? "available"]));
    }
  } catch {}
  return Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, "available" as AvailDay]));
}

type AvailabilityStatus = "available" | "limited" | "unavailable";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function readTimeSessions(): TimeSession[] {
  try {
    const raw = localStorage.getItem(TIME_SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as TimeSession[]) : [];
  } catch { return []; }
}

function writeTimeSessions(sessions: TimeSession[]) {
  try { localStorage.setItem(TIME_SESSIONS_KEY, JSON.stringify(sessions)); } catch {}
}

function readWeeklyGoal(): WeeklyGoal {
  try {
    const raw = localStorage.getItem(WEEKLY_GOAL_KEY);
    if (raw) return JSON.parse(raw) as WeeklyGoal;
  } catch {}
  return { target: 2000, hourlyRate: 75 };
}

function writeWeeklyGoal(goal: WeeklyGoal) {
  try { localStorage.setItem(WEEKLY_GOAL_KEY, JSON.stringify(goal)); } catch {}
}

function getWmoCondition(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rainy";
  if (code <= 77) return "Snowy";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Stormy";
}

function formatElapsed(startedAt: string, now: Date): string {
  const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  return `${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function CockpitHero({ onNavigate }: { onNavigate: (d: PrimaryDestination) => void }) {
  const [sessions, setSessions] = useState<TimeSession[]>(readTimeSessions);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeSession = sessions.find((s) => !s.endedAt) ?? null;

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`
        )
          .then((r) => r.json())
          .then((data) => {
            const cw = (data as { current_weather?: { temperature: number; weathercode: number } }).current_weather;
            if (!cw) return;
            setWeather({ temp: Math.round(cw.temperature), condition: getWmoCondition(cw.weathercode) });
          })
          .catch(() => {});
      },
      () => {}
    );
  }, []);

  function clockIn() {
    const newSession: TimeSession = {
      id: `ts_${Date.now()}`,
      jobId: null,
      jobTitle: "Field work",
      startedAt: new Date().toISOString(),
      endedAt: null,
      notes: "",
    };
    const updated = [...sessions, newSession];
    setSessions(updated);
    writeTimeSessions(updated);
  }

  function clockOut() {
    if (!activeSession) return;
    const updated = sessions.map((s) =>
      s.id === activeSession.id ? { ...s, endedAt: new Date().toISOString() } : s
    );
    setSessions(updated);
    writeTimeSessions(updated);
  }

  function handleCheckin() {
    const saveEntry = (lat: number | null, lon: number | null) => {
      const entry: CheckinEntry = {
        id: `ci_${Date.now()}`,
        timestamp: new Date().toISOString(),
        lat,
        lon,
        label: "On-site check-in",
      };
      try {
        const existing = JSON.parse(localStorage.getItem(CHECKIN_LOG_KEY) ?? "[]") as CheckinEntry[];
        localStorage.setItem(CHECKIN_LOG_KEY, JSON.stringify([...existing, entry]));
      } catch {}
      setCheckedIn(true);
    };

    if (!navigator.geolocation) { saveEntry(null, null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => saveEntry(pos.coords.latitude, pos.coords.longitude),
      () => saveEntry(null, null)
    );
  }

  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="v2-cockpit-hero">
      <div className="v2-cockpit-clock">
        <div className="v2-cockpit-time">{timeStr}</div>
        <div className="v2-cockpit-date">{dateStr}</div>
        {weather && (
          <div className="v2-cockpit-weather">
            <CloudSun size={14} />
            <span>{weather.temp}°F · {weather.condition}</span>
          </div>
        )}
      </div>

      <div className="v2-cockpit-session">
        {activeSession ? (
          <>
            <div className="v2-cockpit-active-badge">
              <Timer size={13} />
              <span>Clocked in · {formatElapsed(activeSession.startedAt, now)}</span>
            </div>
            <button type="button" className="v2-cockpit-clockout-btn" onClick={clockOut}>
              Clock out
            </button>
          </>
        ) : (
          <>
            <div className="v2-cockpit-idle-badge">
              <Clock size={13} />
              <span>Not clocked in</span>
            </div>
            <button type="button" className="v2-cockpit-clockin-btn" onClick={clockIn}>
              <Clock size={15} /> Clock in
            </button>
          </>
        )}
        <button
          type="button"
          className={`v2-cockpit-checkin-btn${checkedIn ? " is-checked" : ""}`}
          onClick={handleCheckin}
        >
          <Navigation2 size={14} />
          <span>{checkedIn ? "Checked in ✓" : "On-site check-in"}</span>
        </button>
      </div>
    </div>
  );
}

function QuickActionsBar({ onNavigate }: { onNavigate: (d: PrimaryDestination) => void }) {
  const actions: Array<{ label: string; Icon: React.ElementType; destination: PrimaryDestination }> = [
    { label: "Clock In/Out", Icon: Clock, destination: "tools" },
    { label: "Log Expense", Icon: CircleDollarSign, destination: "tools" },
    { label: "Take Photo", Icon: Camera, destination: "tools" },
    { label: "Daily Log", Icon: ClipboardCheck, destination: "tools" },
  ];
  return (
    <div className="v2-quick-actions">
      {actions.map(({ label, Icon, destination }) => (
        <button key={label} type="button" onClick={() => onNavigate(destination)}>
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function WeeklyGoalCard() {
  const [goal, setGoal] = useState<WeeklyGoal>(readWeeklyGoal);
  const [editing, setEditing] = useState(false);
  const [targetDraft, setTargetDraft] = useState(String(goal.target));
  const [rateDraft, setRateDraft] = useState(String(goal.hourlyRate));

  const sessions = readTimeSessions();
  const weekStart = getWeekStart();
  const weekSessions = sessions.filter((s) => s.endedAt && new Date(s.startedAt) >= weekStart);
  const weekHours = weekSessions.reduce((sum, s) => {
    if (!s.endedAt) return sum;
    return sum + (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 3_600_000;
  }, 0);
  const estimated = Math.round(weekHours * goal.hourlyRate);
  const progress = goal.target > 0 ? Math.min(1, estimated / goal.target) : 0;

  function saveGoal() {
    const t = Number(targetDraft) || 0;
    const r = Number(rateDraft) || 0;
    const g: WeeklyGoal = { target: t, hourlyRate: r };
    setGoal(g);
    writeWeeklyGoal(g);
    setEditing(false);
  }

  function startEdit() {
    setTargetDraft(String(goal.target));
    setRateDraft(String(goal.hourlyRate));
    setEditing((e) => !e);
  }

  return (
    <aside className="v2-weekly-goal">
      <header>
        <span><Target size={13} /> Weekly goal</span>
        <button type="button" onClick={startEdit}>{editing ? "Cancel" : "Edit"}</button>
      </header>
      {editing ? (
        <div className="v2-weekly-goal-editor">
          <label>
            <small>Weekly target ($)</small>
            <input
              type="number"
              value={targetDraft}
              min={0}
              onChange={(e) => setTargetDraft(e.target.value)}
            />
          </label>
          <label>
            <small>Your hourly rate ($)</small>
            <input
              type="number"
              value={rateDraft}
              min={0}
              onChange={(e) => setRateDraft(e.target.value)}
            />
          </label>
          <button type="button" className="v2-primary-button" onClick={saveGoal}>Save</button>
        </div>
      ) : (
        <>
          <div className="v2-weekly-goal-numbers">
            <div>
              <strong>{currency(estimated)}</strong>
              <small>earned this week</small>
            </div>
            <div>
              <strong>{currency(goal.target)}</strong>
              <small>goal</small>
            </div>
            <div>
              <strong>{weekHours.toFixed(1)}h</strong>
              <small>logged</small>
            </div>
          </div>
          <div className="v2-weekly-goal-bar">
            <div className="v2-weekly-goal-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <small className="v2-weekly-goal-pct">
            {Math.round(progress * 100)}% of goal · ${goal.hourlyRate}/hr rate
          </small>
        </>
      )}
    </aside>
  );
}

interface HomeDashboardProps {
  role: Role;
  name: string;
  location: string;
  activeJob: Job | null;
  upcomingJobs: Job[];
  applicationCount: number;
  unreadCount: number;
  pendingPaymentCount: number;
  communityCount: number;
  shoutOutCount: number;
  availabilityStatus: AvailabilityStatus;
  primaryTrade: string;
  newsCount: number;
  answerQueueCount: number;
  onPostJob: () => void;
  onOpenJob: (jobId: number) => void;
  onNavigate: (destination: PrimaryDestination) => void;
  onSetAvailability: (status: AvailabilityStatus) => Promise<void>;
}

export function HomeDashboard({
  role,
  name,
  location,
  activeJob,
  upcomingJobs,
  applicationCount,
  unreadCount,
  pendingPaymentCount,
  communityCount,
  shoutOutCount,
  availabilityStatus,
  primaryTrade,
  newsCount,
  answerQueueCount,
  onPostJob,
  onOpenJob,
  onNavigate,
  onSetAvailability,
}: HomeDashboardProps) {
  const firstName = name.trim().split(/\s+/)[0] || "there";
  const [savingAvailability, setSavingAvailability] = useState<AvailabilityStatus | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [weeklyAvail, setWeeklyAvail] = useState<Record<number, AvailDay>>(readWeeklyAvailability);

  const cycleWeeklyDay = useCallback((dayIndex: number) => {
    setWeeklyAvail((prev) => {
      const current = prev[dayIndex] ?? "available";
      const next = AVAIL_CYCLE[(AVAIL_CYCLE.indexOf(current) + 1) % AVAIL_CYCLE.length];
      const next_ = { ...prev, [dayIndex]: next };
      try { localStorage.setItem(WEEKLY_AVAIL_KEY, JSON.stringify(next_)); } catch {}
      return next_;
    });
  }, []);
  const moneySignal = activeJob ? currency(activeJob.pay) : role === "contractor" ? "Post work" : `${upcomingJobs.length} matches`;
  const workSignal = role === "contractor"
    ? `${applicationCount || "No"} applicants`
    : `${upcomingJobs.length} jobs nearby`;
  const availabilityCopy = {
    available: role === "contractor" ? "Open to crew conversations" : "Shown as ready for work",
    limited: role === "contractor" ? "Some capacity today" : "Available with limits",
    unavailable: role === "contractor" ? "Booked for now" : "Hidden from quick-availability signals",
  } satisfies Record<AvailabilityStatus, string>;
  const availabilityOptions: Array<{ status: AvailabilityStatus; label: string; detail: string }> = [
    { status: "available", label: "Available", detail: role === "contractor" ? "Taking conversations" : "Ready for work" },
    { status: "limited", label: "Limited", detail: "Some openings" },
    { status: "unavailable", label: "Booked", detail: "Not looking today" },
  ];
  const dailySignals = [
    {
      label: role === "contractor" ? "Applicants" : "Work",
      value: workSignal,
      detail: role === "contractor" ? "Review applicants or invite saved people" : "Check jobs that fit your trade and area",
      action: "View",
      destination: "work" as PrimaryDestination,
    },
    {
      label: "Payments",
      value: moneySignal,
      detail: pendingPaymentCount ? `${pendingPaymentCount} payment record${pendingPaymentCount === 1 ? "" : "s"} need review` : "Invoices and records are current",
      action: "Open Tools",
      destination: "tools" as PrimaryDestination,
    },
    {
      label: "Crew",
      value: `${shoutOutCount} shout-outs`,
      detail: role === "contractor" ? "Keep reliable subs close" : "Build proof other contractors can trust",
      action: "View",
      destination: "crew" as PrimaryDestination,
    },
    {
      label: "Shop Talk",
      value: answerQueueCount ? `${answerQueueCount} need answers` : `${communityCount} posts`,
      detail: answerQueueCount
        ? `${primaryTrade} and General questions you can help close`
        : `${newsCount} trade updates plus questions in Shop Talk`,
      action: answerQueueCount ? "Answer" : "Browse",
      destination: "shop-talk" as PrimaryDestination,
    },
  ];
  const habitLoop = [
    {
      label: "Find the next move",
      detail: role === "contractor" ? "Review applicants, invites, and upcoming crew needs." : "Check work that fits your trade and availability.",
      icon: BriefcaseBusiness,
      action: "Work",
      destination: "work" as PrimaryDestination,
    },
    {
      label: "Leave proof",
      detail: "Write the daily log while details are still fresh.",
      icon: ClipboardCheck,
      action: "Daily log",
      destination: "tools" as PrimaryDestination,
    },
    {
      label: "Build reputation",
      detail: answerQueueCount
        ? `Answer one ${primaryTrade} question before the day gets busy.`
        : "Read trade news or help in Shop Talk when questions open up.",
      icon: answerQueueCount ? MessageSquareText : Newspaper,
      action: answerQueueCount ? "Answer" : "Shop Talk",
      destination: "shop-talk" as PrimaryDestination,
    },
  ];
  async function handleAvailability(status: AvailabilityStatus) {
    if (status === availabilityStatus || savingAvailability) return;
    setSavingAvailability(status);
    setAvailabilityMessage("");
    try {
      await onSetAvailability(status);
      setAvailabilityMessage("Availability saved to your profile.");
    } catch (error) {
      setAvailabilityMessage(error instanceof Error ? error.message : "Availability could not be saved.");
    } finally {
      setSavingAvailability(null);
    }
  }

  return (
    <section className="v2-home-page" aria-label="Home">
      <PageHeader
        className="v2-home-header"
        title={`Good morning, ${firstName}`}
        description={location}
        actions={role === "contractor" ? (
          <button type="button" className="v2-primary-button" onClick={onPostJob}><Plus size={17} /> Post work</button>
        ) : (
          <button type="button" className="v2-primary-button" onClick={() => onNavigate("work")}><BriefcaseBusiness size={17} /> Find work</button>
        )}
      />

      <CockpitHero onNavigate={onNavigate} />
      <QuickActionsBar onNavigate={onNavigate} />

      <section className="v2-daily-brief" aria-label="RIVT Daily">
        <div className="v2-daily-action-stack">
          <header className="v2-daily-brief-header">
            <span>RIVT Daily</span>
          </header>
          <div className="v2-daily-signal-grid">
            {dailySignals.map((signal) => (
              <button type="button" key={signal.label} onClick={() => onNavigate(signal.destination)}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
                <small>{signal.detail}</small>
                <em>{signal.action} <ArrowRight size={13} /></em>
              </button>
            ))}
          </div>
          <div className="v2-daily-habit-loop" aria-label="Today's RIVT habit loop">
            <header>
              <span>Today&apos;s loop</span>
              <strong>Work. Record. Reputation.</strong>
            </header>
            <div>
              {habitLoop.map((item) => {
                const Icon = item.icon;
                return (
                  <button type="button" key={item.label} onClick={() => onNavigate(item.destination)}>
                    <Icon size={16} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                    <em>{item.action}</em>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="v2-home-focus-grid">
        <article className="v2-today-panel">
          <header>
            <span>Today</span>
            <small>{activeJob ? activeJob.status : "No active job"}</small>
          </header>
          {activeJob ? (
            <>
              <div className="v2-today-job">
                <div>
                  <span>{activeJob.trade}</span>
                  <h2>{activeJob.title}</h2>
                  <p><MapPin size={14} /> {activeJob.location}</p>
                </div>
                <strong>{currency(activeJob.pay)}</strong>
              </div>
              <div className="v2-today-facts">
                <span><CalendarClock size={15} /> {activeJob.durationHours}h estimate</span>
                <span><Users size={15} /> {activeJob.applicants} interested</span>
                <span><Wrench size={15} /> {activeJob.tools.length} tools listed</span>
              </div>
              <div className="v2-today-actions">
                <button type="button" className="v2-primary-button" onClick={() => onOpenJob(activeJob.id)}>Open job <ArrowRight size={16} /></button>
                <button type="button" onClick={() => onNavigate("messages")}><MessageSquareText size={16} /> Message</button>
                <button type="button" onClick={() => onNavigate("tools")}><FileText size={16} /> Invoice</button>
              </div>
            </>
          ) : (
            <EmptyState
              className="v2-home-empty"
              icon={<BriefcaseBusiness size={24} />}
              title={role === "contractor" ? "Post your first job" : "Find your next job"}
              description={role === "contractor" ? "Describe the work and invite people from your network." : "Browse work that matches your trade and availability."}
            />
          )}
        </article>

        <div className="v2-home-side-stack">
          <WeeklyGoalCard />

          <aside className="v2-availability-radar">
            <header>
              <div>
                <span>Availability radar</span>
                <strong>{availabilityCopy[availabilityStatus]}</strong>
              </div>
              <small>{primaryTrade}</small>
            </header>
            <div className="v2-availability-options" role="group" aria-label="Daily availability">
              {availabilityOptions.map((option) => (
                <button
                  key={option.status}
                  type="button"
                  className={availabilityStatus === option.status ? "active" : ""}
                  aria-pressed={availabilityStatus === option.status}
                  disabled={Boolean(savingAvailability)}
                  onClick={() => void handleAvailability(option.status)}
                >
                  <strong>{savingAvailability === option.status ? "Saving" : option.label}</strong>
                  <small>{option.detail}</small>
                </button>
              ))}
            </div>
            {availabilityMessage && <small className="v2-availability-message">{availabilityMessage}</small>}
          </aside>

          <aside className="v2-attention-panel">
            <header><span>Needs attention</span><button type="button" onClick={() => onNavigate("messages")}>Open messages</button></header>
            <button type="button" onClick={() => onNavigate("work")}>
              <span className="v2-attention-icon"><Users size={17} /></span>
              <span><strong>{applicationCount || "No"} {role === "contractor" ? "applicants" : "applications"}</strong><small>{applicationCount ? "Review the latest activity" : "Nothing waiting right now"}</small></span>
              <ArrowRight size={15} />
            </button>
            <button type="button" onClick={() => onNavigate("messages")}>
              <span className="v2-attention-icon"><MessageSquareText size={17} /></span>
              <span><strong>{unreadCount || "No"} unread updates</strong><small>{unreadCount ? "Messages and job activity" : "You're caught up"}</small></span>
              <ArrowRight size={15} />
            </button>
            <button type="button" onClick={() => onNavigate("tools")}>
              <span className="v2-attention-icon"><CircleDollarSign size={17} /></span>
              <span><strong>{pendingPaymentCount || "No"} pending payments</strong><small>{pendingPaymentCount ? "Review payment records" : "Payment log is current"}</small></span>
              <ArrowRight size={15} />
            </button>
          </aside>
        </div>
      </div>

      <div className="v2-home-secondary-grid">
        <section className="v2-next-work">
          <header><div><h2>Next work</h2><p>Jobs ready for a decision.</p></div><button type="button" onClick={() => onNavigate("work")}>View all</button></header>
          <div className="v2-next-work-list">
            {upcomingJobs.length === 0 ? (
              <p className="v2-next-work-empty">No jobs waiting on a decision. <button type="button" onClick={() => onNavigate("work")}>Browse work</button></p>
            ) : upcomingJobs.slice(0, 3).map((job) => (
              <button type="button" key={job.id} onClick={() => onOpenJob(job.id)}>
                <span><small>{job.trade} - {job.location}</small><strong>{job.title}</strong></span>
                <span><strong>{currency(job.pay)}</strong><small>{job.status}</small></span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>

        <section className="v2-network-pulse">
          <header><div><h2>Your crew</h2><p>People and field knowledge.</p></div><button type="button" onClick={() => onNavigate("crew")}>Open crew</button></header>
          <div>
            <button type="button" onClick={() => onNavigate("crew")}><Users size={18} /><span><strong>{shoutOutCount} shout-outs</strong><small>Peer reputation</small></span><ArrowRight size={15} /></button>
            <button type="button" onClick={() => onNavigate("shop-talk")}><MessageSquareText size={18} /><span><strong>{communityCount} discussions</strong><small>Shop Talk</small></span><ArrowRight size={15} /></button>
            <button type="button" onClick={() => onNavigate("tools")}><Wrench size={18} /><span><strong>Field tools</strong><small>Estimate, invoice, and records</small></span><ArrowRight size={15} /></button>
          </div>
        </section>
      </div>

      <section className="v2-weekly-calendar" aria-label="Weekly availability">
        <header className="v2-weekly-cal-header">
          <div>
            <h2>Week ahead</h2>
            <p>Tap a day to cycle availability. Saved to this device.</p>
          </div>
        </header>
        <div className="v2-weekly-cal-grid">
          {WEEK_DAY_SHORT.map((short, i) => {
            const today = new Date().getDay();
            const status = weeklyAvail[i] ?? "available";
            return (
              <button
                key={short}
                type="button"
                className={`v2-weekly-cal-day avail-${status}${i === today ? " is-today" : ""}`}
                aria-label={`${WEEK_DAY_FULL[i]}: ${status}. Tap to change.`}
                onClick={() => cycleWeeklyDay(i)}
              >
                <span className="v2-weekly-cal-dayname">{short}</span>
                <span className="v2-weekly-cal-dot" aria-hidden="true" />
                <small className="v2-weekly-cal-label">{AVAIL_DAY_LABEL[status]}</small>
              </button>
            );
          })}
        </div>
      </section>
    </section>
  );
}
