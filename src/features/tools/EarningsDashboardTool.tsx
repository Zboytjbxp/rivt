import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { Job } from "../../types";
import { EmptyState, Panel } from "../../components/ui";
import { readPrimaryHourlyRate } from "../../lib/rateCard";

interface PaymentRecord {
  id: number;
  jobId: number;
  jobTitle: string;
  worker: string;
  amount: number;
  method: string;
  status: "Payment pending" | "Paid / Closed";
  date: string;
}

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekStartDate(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  return new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000 + (week - 1) * 7 * 86400000);
}

function EarningsDashboardTool({ jobs, paymentRecords }: { jobs: Job[]; paymentRecords: PaymentRecord[] }) {
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");

  const now = new Date();
  const cutoff = period === "week"
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    : period === "month"
    ? new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    : null;

  const allPaid = paymentRecords.filter((r) => r.status === "Paid / Closed");
  const periodPaid = cutoff ? allPaid.filter((r) => new Date(r.date) >= cutoff) : allPaid;
  const totalEarned = periodPaid.reduce((sum, r) => sum + r.amount, 0);
  const avgJobSize = periodPaid.length ? totalEarned / periodPaid.length : 0;
  const pending = paymentRecords.filter((r) => r.status === "Payment pending");

  const tradeTotals: Record<string, number> = {};
  for (const r of periodPaid) {
    const job = jobs.find((j) => j.id === r.jobId);
    if (job) tradeTotals[job.trade] = (tradeTotals[job.trade] ?? 0) + r.amount;
  }
  const topTrade = Object.entries(tradeTotals).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "—";

  // ── Weekly earnings chart data (last 8 weeks from time sessions × hourly rate) ──
  const weeklyData = useMemo(() => {
    const timeSessions: Array<{ startedAt: string; endedAt: string | null; jobTitle?: string }> = (() => {
      try { return JSON.parse(localStorage.getItem("rivt.timeSessions.v1") ?? "[]") as Array<{ startedAt: string; endedAt: string | null; jobTitle?: string }>; } catch { return []; }
    })();
    const hourlyRate = readPrimaryHourlyRate(65);
    const weekTotals: Record<string, number> = {};
    for (const s of timeSessions) {
      if (!s.endedAt) continue;
      const start = new Date(s.startedAt);
      const hrs = (new Date(s.endedAt).getTime() - start.getTime()) / 3600000;
      const year = start.getFullYear();
      const week = getISOWeek(start);
      const key = `${year}-W${String(week).padStart(2, "0")}`;
      weekTotals[key] = (weekTotals[key] ?? 0) + hrs * hourlyRate;
    }
    const currentYear = now.getFullYear();
    const currentWeek = getISOWeek(now);
    const weeks: Array<{ label: string; amount: number }> = [];
    for (let i = 7; i >= 0; i--) {
      let targetWeek = currentWeek - i;
      let targetYear = currentYear;
      if (targetWeek <= 0) { targetYear -= 1; targetWeek += 52; }
      const key = `${targetYear}-W${String(targetWeek).padStart(2, "0")}`;
      const weekStart = getWeekStartDate(targetYear, targetWeek);
      const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      weeks.push({ label, amount: weekTotals[key] ?? 0 });
    }
    return weeks;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maxWeekAmount = Math.max(...weeklyData.map((w) => w.amount), 1);

  // ── Expense category breakdown ──
  const categoryData = useMemo(() => {
    const expenses: Array<{ category: string; amount: number }> = (() => {
      try { return JSON.parse(localStorage.getItem("rivt.expenses.v1") ?? "[]") as Array<{ category: string; amount: number }>; } catch { return []; }
    })();
    const totals: Record<string, number> = {};
    for (const e of expenses) {
      totals[e.category] = (totals[e.category] ?? 0) + e.amount;
    }
    const grandExpTotal = Object.values(totals).reduce((s, v) => s + v, 0);
    return Object.entries(totals)
      .sort(([, a], [, b]) => b - a)
      .map(([name, catTotal]) => ({ name, total: catTotal, pct: grandExpTotal > 0 ? (catTotal / grandExpTotal) * 100 : 0 }));
  }, []);

  // ── Top jobs by earnings (time sessions × rate) ──
  const topJobs = useMemo(() => {
    const timeSessions: Array<{ startedAt: string; endedAt: string | null; jobTitle?: string }> = (() => {
      try { return JSON.parse(localStorage.getItem("rivt.timeSessions.v1") ?? "[]") as Array<{ startedAt: string; endedAt: string | null; jobTitle?: string }>; } catch { return []; }
    })();
    const hourlyRate = readPrimaryHourlyRate(65);
    const byJob: Record<string, number> = {};
    for (const s of timeSessions) {
      if (!s.endedAt) continue;
      const hrs = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 3600000;
      const title = s.jobTitle ?? "Standalone";
      byJob[title] = (byJob[title] ?? 0) + hrs * hourlyRate;
    }
    return Object.entries(byJob)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([title, earned]) => ({ title, earned }));
  }, []);

  return (
    <div className="v2-tool-workbench v2-earnings-workbench">
      <Panel className="v2-tool-panel" eyebrow="Earnings" title="Income summary">
        <div className="v2-earnings-period-tabs" role="group" aria-label="Period">
          {(["week", "month", "all"] as const).map((p) => (
            <button key={p} type="button" className={period === p ? "is-active" : ""} onClick={() => setPeriod(p)}>
              {p === "week" ? "Last 7 days" : p === "month" ? "Last 30 days" : "All time"}
            </button>
          ))}
        </div>
        <div className="v2-tool-result-grid">
          <article><span>Total earned</span><strong>{currency(totalEarned)}</strong></article>
          <article><span>Jobs completed</span><strong>{periodPaid.length}</strong></article>
          <article><span>Avg job size</span><strong>{currency(avgJobSize)}</strong></article>
          <article><span>Top trade</span><strong>{topTrade}</strong></article>
        </div>
        {pending.length ? (
          <div className="v2-earnings-pending-bar">
            <strong>{pending.length} pending</strong>
            <span>{currency(pending.reduce((sum, r) => sum + r.amount, 0))} awaiting close-out</span>
          </div>
        ) : null}

        {/* Weekly earnings bar chart */}
        <div className="v2-earn-chart">
          <div className="v2-earn-chart-title">Weekly earnings (last 8 weeks)</div>
          {weeklyData.map((week, i) => (
            <div key={i} className="v2-earn-chart-row">
              <span className="v2-earn-chart-label">{week.label}</span>
              <div className="v2-earn-chart-bar-wrap">
                <div
                  className="v2-earn-chart-bar"
                  style={{ width: `${(week.amount / maxWeekAmount) * 100}%` }}
                />
              </div>
              <span className="v2-earn-chart-value">${week.amount.toFixed(0)}</span>
            </div>
          ))}
        </div>

        {/* Expense category breakdown */}
        {categoryData.length > 0 ? (
          <>
            <div className="v2-earn-section-title">Expenses by category</div>
            {categoryData.map((cat) => (
              <div key={cat.name} className="v2-earn-cat-row">
                <span className="v2-earn-cat-name">{cat.name}</span>
                <div className="v2-earn-cat-bar-wrap">
                  <div className="v2-earn-cat-bar" style={{ width: `${cat.pct}%` }} />
                </div>
                <span className="v2-earn-cat-amount">${cat.total.toFixed(0)}</span>
              </div>
            ))}
          </>
        ) : null}

        {/* Top jobs by earnings */}
        {topJobs.length > 0 ? (
          <>
            <div className="v2-earn-section-title">Top jobs by earnings</div>
            {topJobs.map((job, i) => (
              <div key={i} className="v2-earn-top-job-row">
                <span className="v2-earn-top-job-rank">#{i + 1}</span>
                <span className="v2-earn-top-job-name">{job.title}</span>
                <span className="v2-earn-top-job-amount">${job.earned.toFixed(0)}</span>
              </div>
            ))}
          </>
        ) : null}
      </Panel>
      <Panel className="v2-tool-panel" eyebrow={`${periodPaid.length} completed`} title="Payment history">
        {periodPaid.length ? (
          <div className="v2-earnings-list">
            {periodPaid.slice(0, 15).map((r) => (
              <article key={r.id} className="v2-earnings-item">
                <div>
                  <strong>{r.jobTitle}</strong>
                  <small>{r.date} · {r.worker} · {r.method}</small>
                </div>
                <strong>{currency(r.amount)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState className="v2-tools-empty" icon={<TrendingUp size={20} />} title="No completed payments in this period" description="Closed-out payment records will appear here." compact />
        )}
      </Panel>
    </div>
  );
}

export { EarningsDashboardTool };
export type { PaymentRecord };
