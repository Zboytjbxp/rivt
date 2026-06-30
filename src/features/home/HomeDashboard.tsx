import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  CloudSun,
  FileText,
  Flame,
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
import { readPrimaryHourlyRate } from "../../lib/rateCard";
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
const JOBS_UPCOMING_KEY = "rivt.jobs.v1";
const GOALS_KEY = "rivt.goals.v1";
const EXPENSES_KEY = "rivt.expenses.v1";

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

interface UpcomingJob {
  id: string | number;
  title: string;
  scheduledDate?: string;
  status: string;
  client?: string;
  address?: string;
}

interface RevenueGoals {
  weeklyGoal: number;
  monthlyGoal: number;
}

interface RivtTimeSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  ratePerHour?: number;
}

interface RivtExpense {
  id: string;
  date: string;
  amount: number;
}

function readUpcomingJobs(): UpcomingJob[] {
  try {
    const raw = localStorage.getItem(JOBS_UPCOMING_KEY);
    return raw ? (JSON.parse(raw) as UpcomingJob[]) : [];
  } catch { return []; }
}

function readRevenueGoals(): RevenueGoals {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (raw) return JSON.parse(raw) as RevenueGoals;
  } catch { /* noop */ }
  return { weeklyGoal: 2000, monthlyGoal: 8000 };
}

function writeRevenueGoals(goals: RevenueGoals) {
  try { localStorage.setItem(GOALS_KEY, JSON.stringify(goals)); } catch { /* noop */ }
}

function readRivtTimeSessions(): RivtTimeSession[] {
  try {
    const raw = localStorage.getItem(TIME_SESSIONS_KEY);
    return raw ? (JSON.parse(raw) as RivtTimeSession[]) : [];
  } catch { return []; }
}

function readRivtExpenses(): RivtExpense[] {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    return raw ? (JSON.parse(raw) as RivtExpense[]) : [];
  } catch { return []; }
}

function formatTimeAgo(timestamp: string, now: Date): string {
  const diffMs = now.getTime() - new Date(timestamp).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function readCheckinLog(): CheckinEntry[] {
  try {
    const raw = localStorage.getItem(CHECKIN_LOG_KEY);
    return raw ? (JSON.parse(raw) as CheckinEntry[]) : [];
  } catch { return []; }
}

function readWeeklyAvailability(): Record<number, AvailDay> {
  try {
    const raw = localStorage.getItem(WEEKLY_AVAIL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, AvailDay>;
      return Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i, parsed[i] ?? "available"]));
    }
  } catch { /* noop */ }
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
  try { localStorage.setItem(TIME_SESSIONS_KEY, JSON.stringify(sessions)); } catch { /* noop */ }
}

function readWeeklyGoal(): WeeklyGoal {
  try {
    const raw = localStorage.getItem(WEEKLY_GOAL_KEY);
    if (raw) return JSON.parse(raw) as WeeklyGoal;
  } catch { /* noop */ }
  return { target: 2000, hourlyRate: 75 };
}

function writeWeeklyGoal(goal: WeeklyGoal) {
  try { localStorage.setItem(WEEKLY_GOAL_KEY, JSON.stringify(goal)); } catch { /* noop */ }
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

function triggerWeeklyRecapIfDue() {
  const now = new Date();
  if (now.getDay() !== 5 || now.getHours() < 17) return; // Friday after 5pm only
  const weekKey = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`;
  if (localStorage.getItem("rivt.weeklyRecap.v1") === weekKey) return;

  const sessions: TimeSession[] = (() => {
    try { return JSON.parse(localStorage.getItem(TIME_SESSIONS_KEY) ?? "[]"); } catch { return []; }
  })();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
  weekStart.setHours(0, 0, 0, 0);

  const weekSessions = sessions.filter(s => s.endedAt && new Date(s.startedAt) >= weekStart);
  const totalHours = weekSessions.reduce((sum, s) => {
    return sum + (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 3_600_000;
  }, 0);
  const rate = readPrimaryHourlyRate(75);
  const earned = Math.round(totalHours * rate);

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    navigator.serviceWorker?.ready.then(reg => {
      reg.showNotification("Your week in numbers 🔨", {
        body: `${Math.round(totalHours * 10) / 10}h worked · ~$${earned.toLocaleString()} earned — great week.`,
        icon: "/rivt-app-icon-192.png",
        tag: "rivt-weekly-recap",
      });
    }).catch(() => { /* noop */ });
  }

  try { localStorage.setItem("rivt.weeklyRecap.v1", weekKey); } catch { /* noop */ }
}

function CockpitHero({ onNavigate: _onNavigate }: { onNavigate: (d: PrimaryDestination) => void }) {
  const [sessions, setSessions] = useState<TimeSession[]>(readTimeSessions);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkinLog, setCheckinLog] = useState<CheckinEntry[]>(readCheckinLog);
  const [daySummary, setDaySummary] = useState<{
    hours: number; earned: number; expenseCount: number; expenseTotal: number;
  } | null>(null);
  const [onMyWayCopied, setOnMyWayCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeSession = sessions.find((s) => !s.endedAt) ?? null;
  const lastCheckin = checkinLog.length > 0 ? checkinLog[checkinLog.length - 1] : null;

  const hourlyRate = readWeeklyGoal().hourlyRate;
  const earningsStr = activeSession
    ? (() => {
        const elapsedHrs = Math.max(0, (now.getTime() - new Date(activeSession.startedAt).getTime()) / 3_600_000);
        return `Earning $${(elapsedHrs * hourlyRate).toFixed(2)}`;
      })()
    : null;

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
          .catch(() => { /* noop */ });
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
    const endedAt = new Date().toISOString();
    const updated = sessions.map((s) =>
      s.id === activeSession.id ? { ...s, endedAt } : s
    );
    setSessions(updated);
    writeTimeSessions(updated);

    // Compute today's stats
    const hours = Math.round(
      (new Date(endedAt).getTime() - new Date(activeSession.startedAt).getTime()) / 360000
    ) / 10;
    const rate = readPrimaryHourlyRate(75);
    const today = new Date().toISOString().slice(0, 10);
    const expenses: Array<{ date: string; amount: number }> = (() => {
      try { return JSON.parse(localStorage.getItem("rivt.expenses.v1") ?? "[]"); } catch { return []; }
    })();
    const todayExpenses = expenses.filter(e => e.date === today);
    setDaySummary({
      hours,
      earned: Math.round(hours * rate),
      expenseCount: todayExpenses.length,
      expenseTotal: Math.round(todayExpenses.reduce((sum, e) => sum + e.amount, 0)),
    });
  }

  async function handleOnMyWay() {
    const msg = `Heading to ${activeSession?.jobTitle ?? "the job"} — be there in ~20 min.`;
    if (navigator.share) {
      try { await navigator.share({ text: msg }); return; } catch { /* noop */ }
    }
    try {
      await navigator.clipboard.writeText(msg);
      // Brief visual feedback
      setOnMyWayCopied(true);
      setTimeout(() => setOnMyWayCopied(false), 2500);
    } catch { /* noop */ }
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
        const updated = [...existing, entry];
        localStorage.setItem(CHECKIN_LOG_KEY, JSON.stringify(updated));
        setCheckinLog(updated);
      } catch { /* noop */ }
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
    <div className={`v2-cockpit-hero${activeSession ? " is-active" : ""}`}>
      <div className="v2-cockpit-clock">
        <div className="v2-cockpit-time">{timeStr}</div>
        <div className="v2-cockpit-date">{dateStr}</div>
        {weather && (
          <div className="v2-cockpit-weather">
            <CloudSun size={14} />
            <span>{weather.temp}°F · {weather.condition}</span>
          </div>
        )}
        {lastCheckin && (
          <div className="v2-cockpit-checkin-time">
            <Navigation2 size={12} />
            <span>Last check-in: {formatTimeAgo(lastCheckin.timestamp, now)}</span>
          </div>
        )}
      </div>

      <div className="v2-cockpit-session">
        {earningsStr && (
          <div className="v2-cockpit-earnings-ticker">
            {earningsStr}
          </div>
        )}
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
        {activeSession && (
          <button type="button" className="v2-on-my-way-btn" onClick={handleOnMyWay}>
            <Navigation2 size={14} />
            {onMyWayCopied ? "Copied!" : "On my way"}
          </button>
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
      {daySummary && (
        <div className="v2-day-summary-backdrop" onClick={() => setDaySummary(null)}>
          <div className="v2-day-summary" onClick={e => e.stopPropagation()}>
            <strong className="v2-day-summary-title">Day complete 🎉</strong>
            <div className="v2-day-summary-grid">
              <div className="v2-day-summary-stat">
                <span>Hours</span>
                <strong>{daySummary.hours}h</strong>
              </div>
              <div className="v2-day-summary-stat">
                <span>Earned</span>
                <strong>${daySummary.earned.toLocaleString()}</strong>
              </div>
              {daySummary.expenseCount > 0 && (
                <div className="v2-day-summary-stat">
                  <span>Expenses</span>
                  <strong>{daySummary.expenseCount} · ${daySummary.expenseTotal}</strong>
                </div>
              )}
            </div>
            <button type="button" className="v2-day-summary-close" onClick={() => setDaySummary(null)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StreakCounter() {
  const [streak, setStreak] = useState(0);
  const [weekDots, setWeekDots] = useState<boolean[]>([]);

  useEffect(() => {
    const sessions = readTimeSessions();
    const completedDates = new Set<string>(
      sessions
        .filter((s) => s.endedAt !== null)
        .map((s) => new Date(s.startedAt).toLocaleDateString("en-CA")) // YYYY-MM-DD in local time
    );

    // Compute streak going backward from today
    let count = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (true) {
      const dateStr = cursor.toLocaleDateString("en-CA");
      if (!completedDates.has(dateStr)) break;
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStreak(count);

    // Compute Mon-Sun dots for current week
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    const dots: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dots.push(completedDates.has(d.toLocaleDateString("en-CA")));
    }
    setWeekDots(dots);
  }, []);

  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <aside className="v2-streak-card">
      <header>
        <span><Flame size={13} /> Streak</span>
      </header>
      {streak === 0 ? (
        <p className="v2-streak-empty">Clock in to start your streak</p>
      ) : (
        <div className="v2-streak-count">
          <Flame size={28} />
          <span>
            <strong>{streak}</strong>
            <small>{streak === 1 ? "day streak" : "days"}</small>
          </span>
        </div>
      )}
      <div className="v2-streak-dots">
        {weekDots.map((active, i) => (
          <span key={i} className={`v2-streak-dot${active ? " is-active" : ""}`} aria-label={DAY_LABELS[i]}>
            <span className="v2-streak-dot-pip" />
            <small>{DAY_LABELS[i]}</small>
          </span>
        ))}
      </div>
    </aside>
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


// ── Feature: Upcoming Jobs Widget ────────────────────────────────────────────

function getStatusPillClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "in progress") return "v2-status-pill--active";
  if (s === "completed" || s === "done") return "v2-status-pill--done";
  if (s === "cancelled" || s === "canceled") return "v2-status-pill--cancelled";
  return "v2-status-pill--default";
}

function UpcomingJobsWidget() {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const upcomingJobs = readUpcomingJobs()
    .filter((j) => {
      if (!j.scheduledDate) return false;
      const t = new Date(j.scheduledDate).getTime();
      return t >= now && t <= now + sevenDaysMs;
    })
    .sort((a, b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime())
    .slice(0, 3);

  return (
    <div className="v2-upcoming-jobs-widget">
      <header className="v2-upcoming-jobs-header">
        <CalendarDays size={13} />
        <span>Upcoming jobs this week</span>
      </header>
      {upcomingJobs.length === 0 ? (
        <div className="v2-upcoming-jobs-empty">
          <CalendarDays size={20} />
          <span>No jobs scheduled this week</span>
        </div>
      ) : (
        <div className="v2-upcoming-jobs-list">
          {upcomingJobs.map((job) => {
            const dateLabel = new Date(job.scheduledDate!).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            return (
              <div key={String(job.id)} className="v2-upcoming-job-card">
                <div className="v2-upcoming-job-date">{dateLabel}</div>
                <div className="v2-upcoming-job-body">
                  <strong className="v2-upcoming-job-title">{job.title}</strong>
                  {job.client && (
                    <span className="v2-upcoming-job-client">{job.client}</span>
                  )}
                </div>
                <span className={`v2-status-pill ${getStatusPillClass(job.status)}`}>
                  {job.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Feature: Revenue Goal Tracker ────────────────────────────────────────────

function RevenueGoalWidget() {
  const [goals, setGoals] = useState<RevenueGoals>(readRevenueGoals);
  const [activeTab, setActiveTab] = useState<"week" | "month">("week");
  const [editing, setEditing] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");

  const now = new Date();

  const weekStart = (() => {
    const d = new Date(now);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const sessions = readRivtTimeSessions();
  const expenses = readRivtExpenses();

  const DEFAULT_RATE = 75;

  function calcEarnings(from: Date): number {
    return sessions
      .filter((s) => s.endedAt && new Date(s.startedAt) >= from)
      .reduce((sum, s) => {
        const hrs = (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 3_600_000;
        return sum + hrs * (s.ratePerHour ?? DEFAULT_RATE);
      }, 0);
  }

  function calcExpenses(from: Date): number {
    return expenses
      .filter((e) => new Date(e.date) >= from)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  const isWeek = activeTab === "week";
  const periodStart = isWeek ? weekStart : monthStart;
  const earned = Math.round(calcEarnings(periodStart));
  const expensesTotal = Math.round(calcExpenses(periodStart));
  const net = earned - expensesTotal;
  const netDisplay = Math.max(0, net);
  const overBudget = net < 0;
  const goalValue = isWeek ? goals.weeklyGoal : goals.monthlyGoal;
  const progress = goalValue > 0 ? Math.min(1, netDisplay / goalValue) : 0;
  const pct = Math.round(progress * 100);

  function startEdit() {
    setGoalDraft(String(goalValue));
    setEditing(true);
  }

  function saveGoal() {
    const val = Number(goalDraft) || 0;
    const updated: RevenueGoals = isWeek
      ? { ...goals, weeklyGoal: val }
      : { ...goals, monthlyGoal: val };
    setGoals(updated);
    writeRevenueGoals(updated);
    setEditing(false);
  }

  return (
    <div className="v2-revenue-goal-widget">
      <div className="v2-revenue-goal-tabs">
        <button
          type="button"
          className={`v2-revenue-tab${activeTab === "week" ? " is-active" : ""}`}
          onClick={() => { setActiveTab("week"); setEditing(false); }}
        >
          This Week
        </button>
        <button
          type="button"
          className={`v2-revenue-tab${activeTab === "month" ? " is-active" : ""}`}
          onClick={() => { setActiveTab("month"); setEditing(false); }}
        >
          This Month
        </button>
      </div>

      <div className="v2-revenue-goal-body">
        {editing ? (
          <div className="v2-revenue-goal-edit">
            <label className="v2-revenue-goal-edit-label">
              <small>{isWeek ? "Weekly" : "Monthly"} goal ($)</small>
              <input
                type="number"
                min={0}
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                className="v2-revenue-goal-input"
                autoFocus
              />
            </label>
            <div className="v2-revenue-goal-edit-actions">
              <button type="button" className="v2-primary-button" onClick={saveGoal}>Save</button>
              <button type="button" className="v2-revenue-cancel-btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="v2-revenue-goal-numbers"
              onClick={startEdit}
              aria-label="Edit goal"
            >
              <strong className="v2-revenue-earned">{currency(netDisplay)}</strong>
              <span className="v2-revenue-separator">/</span>
              <span className="v2-revenue-goal-value">{currency(goalValue)}</span>
            </button>
            {expensesTotal > 0 && !overBudget && (
              <div className="v2-revenue-expense-note">
                −{currency(expensesTotal)} expenses · net shown
              </div>
            )}
            {overBudget && (
              <div className="v2-revenue-expense-note" style={{ color: "var(--v2-warning)" }}>
                −{currency(expensesTotal)} expenses · {currency(Math.abs(net))} over
              </div>
            )}
            <div className="v2-revenue-bar">
              <div
                className="v2-revenue-bar-fill"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
            <div className="v2-revenue-pct">{pct}% of goal</div>
          </>
        )}
      </div>
    </div>
  );
}

const JOBS_V1_KEY = "rivt.jobs.v1";

interface StoredJob {
  id: string | number;
  title: string;
  location?: string;
  startDate?: string | Date;
  status?: string;
}

function readStoredJobs(): StoredJob[] {
  try {
    const raw = localStorage.getItem(JOBS_V1_KEY);
    return raw ? (JSON.parse(raw) as StoredJob[]) : [];
  } catch { return []; }
}

function getWeekStartForOffset(offset: number): Date {
  const now = new Date();
  const day = now.getDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

function WeekSchedule() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [jobs] = useState<StoredJob[]>(() => readStoredJobs());

  const weekStart = getWeekStartForOffset(weekOffset);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const jobsByDay = new Map<string, StoredJob[]>();
  for (const job of jobs) {
    if (!job.startDate) continue;
    const key = new Date(job.startDate).toDateString();
    const existing = jobsByDay.get(key) ?? [];
    existing.push(job);
    jobsByDay.set(key, existing);
  }

  const today = new Date();
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function handleDayClick(day: Date) {
    if (selectedDay && selectedDay.toDateString() === day.toDateString()) {
      setSelectedDay(null);
    } else {
      setSelectedDay(day);
    }
  }

  const selectedJobs = selectedDay ? (jobsByDay.get(selectedDay.toDateString()) ?? []) : [];

  return (
    <div className="v2-week-schedule">
      <div className="v2-schedule-heading">
        <CalendarDays size={13} />
        <span>Schedule</span>
      </div>
      <div className="v2-week-schedule-header">
        <button
          type="button"
          className="v2-week-nav-btn"
          aria-label="Previous week"
          onClick={() => { setWeekOffset((o) => o - 1); setSelectedDay(null); }}
        >
          <ChevronLeft size={16} />
        </button>
        <span className="v2-week-label">This Week · {formatWeekRange(weekStart)}</span>
        <button
          type="button"
          className="v2-week-nav-btn"
          aria-label="Next week"
          onClick={() => { setWeekOffset((o) => o + 1); setSelectedDay(null); }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="v2-days-row">
        {days.map((day, i) => {
          const isToday = day.toDateString() === today.toDateString();
          const isSelected = selectedDay?.toDateString() === day.toDateString();
          const hasJobs = jobsByDay.has(day.toDateString());
          return (
            <button
              key={i}
              type="button"
              className={`v2-day-pill${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`}
              aria-label={`${DAY_NAMES[i]} ${day.getDate()}${hasJobs ? ", has jobs" : ""}`}
              onClick={() => handleDayClick(day)}
            >
              <span className="v2-day-name">{DAY_NAMES[i]}</span>
              <span className="v2-day-num">{day.getDate()}</span>
              {hasJobs && <span className="v2-day-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {selectedDay && (
        <div className="v2-day-jobs">
          {selectedJobs.length === 0 ? (
            <p className="v2-day-no-jobs">No jobs scheduled</p>
          ) : (
            selectedJobs.map((job) => (
              <div key={String(job.id)} className="v2-day-job-row">
                <span className="v2-day-job-title">{job.title}</span>
                {job.location && <span className="v2-day-job-loc"><MapPin size={11} /> {job.location}</span>}
                {job.status && (
                  <span className="v2-day-job-status-badge">{job.status}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
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
  useEffect(() => { triggerWeeklyRecapIfDue(); }, []);
  const [savingAvailability, setSavingAvailability] = useState<AvailabilityStatus | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [weeklyAvail, setWeeklyAvail] = useState<Record<number, AvailDay>>(readWeeklyAvailability);

  const cycleWeeklyDay = useCallback((dayIndex: number) => {
    setWeeklyAvail((prev) => {
      const current = prev[dayIndex] ?? "available";
      const next = AVAIL_CYCLE[(AVAIL_CYCLE.indexOf(current) + 1) % AVAIL_CYCLE.length];
      const next_ = { ...prev, [dayIndex]: next };
      try { localStorage.setItem(WEEKLY_AVAIL_KEY, JSON.stringify(next_)); } catch { /* noop */ }
      return next_;
    });
  }, []);
  const moneySignal = activeJob ? currency(activeJob.pay) : pendingPaymentCount ? `${pendingPaymentCount} pending` : "$0 pending";
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
      label: "Trade Talk",
      value: answerQueueCount ? `${answerQueueCount} need answers` : `${communityCount} posts`,
      detail: answerQueueCount
        ? `${primaryTrade} and General questions you can help close`
        : `${newsCount} trade updates plus questions in Trade Talk`,
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
        : "Read trade news or help in Trade Talk when questions open up.",
      icon: answerQueueCount ? MessageSquareText : Newspaper,
      action: answerQueueCount ? "Answer" : "Trade Talk",
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
        title="Trade talk, built for the trades."
        description="Ask questions, find work, show your craft, and connect with real tradespeople."
        actions={role === "contractor" ? (
          <button
            type="button"
            className="v2-primary-button"
            onClick={onPostJob}
            data-action="post-work"
            aria-label="Post work"
          >
            <Plus size={17} /> Post work
          </button>
        ) : (
          <button type="button" className="v2-primary-button" onClick={() => onNavigate("work")}><BriefcaseBusiness size={17} /> Find work</button>
        )}
      />

      <CockpitHero onNavigate={onNavigate} />
      <WeekSchedule />
      <UpcomingJobsWidget />
      <RevenueGoalWidget />

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
          <StreakCounter />

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
            <button type="button" onClick={() => onNavigate("shop-talk")}><MessageSquareText size={18} /><span><strong>{communityCount} discussions</strong><small>Trade Talk</small></span><ArrowRight size={15} /></button>
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
