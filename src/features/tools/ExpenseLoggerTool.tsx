import { Download, Lock, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Job } from "../../types";
import { EmptyState, Panel } from "../../components/ui";
import { usePro } from "../pro/usePro";
import { UpgradeModal } from "../pro/UpgradeModal";
import { deleteToolRecordByLocalId, fetchToolRecords, upsertToolRecord, type ServerToolRecord } from "./tool-records-api";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

const expenseLogKey = "rivt.expenses.v1";

type ExpenseCategory = "Materials" | "Tools" | "Mileage" | "Subcontractor" | "Permit" | "Other";
const EXPENSE_CATEGORIES: ExpenseCategory[] = ["Materials", "Tools", "Mileage", "Subcontractor", "Permit", "Other"];

interface ExpenseEntry {
  id: string;
  jobId: number | null;
  jobTitle: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: string;
}

function readExpenses(): ExpenseEntry[] {
  try {
    const stored = localStorage.getItem(expenseLogKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as ExpenseEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 200) : [];
  } catch { return []; }
}

function persistExpenses(entries: ExpenseEntry[]) {
  try { localStorage.setItem(expenseLogKey, JSON.stringify(entries.slice(0, 200))); } catch { /* noop */ }
}

function isExpenseEntry(value: unknown): value is ExpenseEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ExpenseEntry>;
  return typeof candidate.id === "string"
    && (candidate.jobId === null || typeof candidate.jobId === "number")
    && typeof candidate.jobTitle === "string"
    && EXPENSE_CATEGORIES.includes(candidate.category as ExpenseCategory)
    && typeof candidate.amount === "number"
    && typeof candidate.description === "string"
    && typeof candidate.date === "string";
}

function expenseFromServer(record: ServerToolRecord): ExpenseEntry | null {
  if (!isExpenseEntry(record.payload)) return null;
  return {
    ...record.payload,
    id: record.localId,
    description: record.payload.description || record.title,
    amount: typeof record.payload.amount === "number" ? record.payload.amount : (record.amountCents ?? 0) / 100,
    date: record.payload.date || record.recordDate || new Date().toISOString().slice(0, 10),
  };
}

function expenseToServerInput(entry: ExpenseEntry) {
  return {
    recordType: "expense" as const,
    localId: entry.id,
    title: entry.description || entry.category,
    status: "active",
    recordDate: entry.date || null,
    amountCents: Math.round(Math.max(0, entry.amount) * 100),
    payload: { ...entry },
  };
}

function exportExpensesCSV(expenses: ExpenseEntry[]) {
  const header = "Date,Category,Amount,Description";
  const rows = expenses.map((e) =>
    [e.date, e.category, e.amount, (e.description ?? "").replace(/,/g, ";")].join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rivt-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ExpenseLoggerTool({ activeJob, jobs }: { activeJob: Job | null; jobs: Job[] }) {
  const { isPro } = usePro();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>(readExpenses);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const [jobId, setJobId] = useState<number | null>(activeJob?.id ?? null);
  const [category, setCategory] = useState<ExpenseCategory>("Materials");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notice, setNotice] = useState("");
  const [quickMode, setQuickMode] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("expense").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Saved on this device. Sign in with network access to sync.");
        return;
      }
      const mapped = serverRecords.map(expenseFromServer).filter((entry): entry is ExpenseEntry => Boolean(entry));
      if (mapped.length) {
        setExpenses(mapped);
        persistExpenses(mapped);
        setSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localSnapshot = readExpenses();
      if (localSnapshot.length) {
        void Promise.all(localSnapshot.map((entry) => upsertToolRecord(expenseToServerInput(entry)))).then((results) => {
          setSyncMessage(results.some(Boolean)
            ? "Local expenses synced to your RIVT account."
            : "Couldn't sync - saved on this device only.");
        });
        return;
      }
      setSyncMessage("New expenses sync to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, []);

  function persistExpenseEntries(next: ExpenseEntry[], changedEntry?: ExpenseEntry) {
    setExpenses(next);
    persistExpenses(next);
    if (!changedEntry) return;
    void upsertToolRecord(expenseToServerInput(changedEntry)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
  }

  function addExpense() {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0 || !description.trim()) return;
    const job = jobs.find((j) => j.id === jobId) ?? null;
    const entry: ExpenseEntry = {
      id: crypto.randomUUID(),
      jobId,
      jobTitle: job?.title ?? "Standalone",
      category,
      amount: amt,
      description: description.trim(),
      date,
    };
    const next = [entry, ...expenses];
    persistExpenseEntries(next, entry);
    setAmount("");
    setDescription("");
    setNotice("Expense logged.");
    setTimeout(() => setNotice(""), 3000);
  }

  function deleteExpense(expenseId: string) {
    const next = expenses.filter((e) => e.id !== expenseId);
    setExpenses(next);
    persistExpenses(next);
    void deleteToolRecordByLocalId("expense", expenseId).then((ok) => {
      setSyncMessage(ok ? "Deleted from this device and your RIVT account." : "Deleted on this device only. Could not sync deletion.");
    });
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = EXPENSE_CATEGORIES.map((cat) => ({
    cat,
    total: expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
  })).filter((c) => c.total > 0);

  return (
    <div className="v2-tool-workbench v2-expense-workbench">
      <Panel className="v2-tool-panel" eyebrow="Log expense" title="Track job costs">
        {/* Mode toggle */}
        <div className="v2-expense-mode-toggle">
          <button
            type="button"
            className={quickMode ? "active" : ""}
            onClick={() => setQuickMode(true)}
          >Quick</button>
          <button
            type="button"
            className={!quickMode ? "active" : ""}
            onClick={() => setQuickMode(false)}
          >Detailed</button>
        </div>

        {quickMode ? (
          /* QUICK MODE */
          <div className="v2-expense-quick">
            <div className="v2-expense-cat-chips">
              {EXPENSE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`v2-expense-cat-chip${category === cat ? " active" : ""}`}
                  onClick={() => setCategory(cat as ExpenseCategory)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="v2-expense-quick-amount">
              <span className="v2-expense-dollar">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="v2-expense-amount-input"
                inputMode="decimal"
              />
            </div>
            {notice ? <p className="v2-record-notice" role="status">{notice}</p> : null}
            <button
              type="button"
              className="v2-primary-button"
              style={{ width: "100%", justifyContent: "center", padding: "14px" }}
              disabled={!(parseFloat(amount) > 0)}
              onClick={() => {
                const amt = parseFloat(amount);
                if (!Number.isFinite(amt) || amt <= 0) return;
                const job = jobs.find(j => j.id === jobId) ?? null;
                const entry: ExpenseEntry = {
                  id: crypto.randomUUID(),
                  jobId,
                  jobTitle: job?.title ?? "Standalone",
                  category,
                  amount: amt,
                  description: category,
                  date: new Date().toISOString().slice(0, 10),
                };
                const next = [entry, ...expenses];
                persistExpenseEntries(next, entry);
                setAmount("");
                setNotice(`${category} — $${amt.toFixed(2)} logged.`);
                setTimeout(() => setNotice(""), 3000);
              }}
            >
              Log {category} — {amount ? `$${parseFloat(amount).toFixed(2)}` : "$0.00"}
            </button>
          </div>
        ) : (
          /* DETAILED MODE */
          <>
            <div className="v2-tool-input-grid two">
              <label>Job
                <select value={jobId ?? ""} onChange={(e) => setJobId(Number(e.target.value) || null)}>
                  <option value="">Standalone / no job</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </label>
              <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <label>Category
                <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>Amount ($)<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
              <label className="is-wide">Description<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Material, rental, mileage description..." /></label>
            </div>
            {notice ? <p className="v2-record-notice" role="status">{notice}</p> : null}
            <div className="v2-tool-action-row">
              <button type="button" className="v2-primary-button" disabled={!(parseFloat(amount) > 0) || !description.trim()} onClick={addExpense}><Plus size={15} />Log expense</button>
              <button type="button" disabled={expenses.length === 0} onClick={() => isPro ? exportExpensesCSV(expenses) : setUpgradeOpen(true)}>
                <Download size={15} />Export CSV{!isPro && <Lock size={11} style={{marginLeft: 4}} />}
              </button>
            </div>
          </>
        )}
        <p className="v2-record-notice" role="status">{syncMessage}</p>
      </Panel>
      <aside className="v2-invoice-side-stack">
        {upgradeOpen && <UpgradeModal reason="Export CSV" onClose={() => setUpgradeOpen(false)} />}
        <Panel className="v2-tool-panel v2-tool-summary-panel" eyebrow="Total spent" title={currency(total)}>
          {byCategory.length ? (
            <div className="v2-tool-breakdown">
              {byCategory.map(({ cat, total: catTotal }) => <div key={cat}><span>{cat}</span><strong>{currency(catTotal)}</strong></div>)}
            </div>
          ) : <p className="v2-tool-note">No expenses logged yet.</p>}
        </Panel>
        <Panel className="v2-tool-panel" eyebrow={`${expenses.length} logged`} title="Expenses">
          {expenses.length ? (
            <div className="v2-expense-list">
              {expenses.slice(0, 12).map((e) => (
                <article key={e.id} className="v2-expense-item">
                  <div>
                    <strong>{e.description}</strong>
                    <small>{e.category} · {e.jobTitle} · {e.date}</small>
                  </div>
                  <div className="v2-expense-item-right">
                    <strong>{currency(e.amount)}</strong>
                    <button type="button" aria-label="Delete" onClick={() => deleteExpense(e.id)}><Trash2 size={13} /></button>
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState className="v2-tools-empty" icon={<ReceiptText size={20} />} title="No expenses yet" description="Log materials, tool rentals, mileage, and other job costs." compact />}
        </Panel>
      </aside>
    </div>
  );
}

// ── Earnings Dashboard ────────────────────────────────────────────────────────

export { ExpenseLoggerTool };
