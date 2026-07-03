import { Briefcase, FileText, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Job } from "../../types";
import { Panel } from "../../components/ui";
import { deleteToolRecordByLocalId, fetchToolRecords, upsertToolRecord, type ServerToolRecord } from "./tool-records-api";

function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

interface DefaultBidLine { description: string; qty: number; unit: string; unitPrice: number; }

function getDefaultBidLines(trade: string | null, overrideDurationHours?: number, overridePay?: number): DefaultBidLine[] {
  const hrs = overrideDurationHours ?? 8;
  const payBase = overridePay ? Math.round(overridePay * 0.2) || 250 : 250;

  const defaults: Record<string, DefaultBidLine[]> = {
    Electrician: [
      { description: "Labor – rough-in", qty: hrs, unit: "hr", unitPrice: 90 },
      { description: "Labor – trim-out", qty: Math.ceil(hrs / 2), unit: "hr", unitPrice: 90 },
      { description: "12/2 Romex wire", qty: 100, unit: "ft", unitPrice: 0.65 },
      { description: "Panel / breakers", qty: 1, unit: "lot", unitPrice: 200 },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 175 },
    ],
    Plumber: [
      { description: "Labor – rough-in", qty: hrs, unit: "hr", unitPrice: 85 },
      { description: "Labor – trim-out", qty: Math.ceil(hrs / 2), unit: "hr", unitPrice: 85 },
      { description: "Copper pipe", qty: 50, unit: "ft", unitPrice: 3.50 },
      { description: "PVC fittings", qty: 1, unit: "lot", unitPrice: 120 },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 150 },
    ],
    Carpenter: [
      { description: "Labor – framing", qty: hrs, unit: "hr", unitPrice: 75 },
      { description: "Labor – finish work", qty: Math.ceil(hrs / 2), unit: "hr", unitPrice: 80 },
      { description: "Lumber", qty: 100, unit: "bd ft", unitPrice: 1.20 },
      { description: "Hardware & fasteners", qty: 1, unit: "lot", unitPrice: 80 },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 100 },
    ],
    HVAC: [
      { description: "Labor – install", qty: hrs, unit: "hr", unitPrice: 95 },
      { description: "Labor – startup & test", qty: 2, unit: "hr", unitPrice: 95 },
      { description: "Equipment", qty: 1, unit: "ea", unitPrice: 2500 },
      { description: "Refrigerant R-410A", qty: 5, unit: "lb", unitPrice: 45 },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 200 },
    ],
    "General Contractor": [
      { description: "Labor – general", qty: hrs, unit: "hr", unitPrice: 70 },
      { description: "Subcontractor allowance", qty: 1, unit: "lot", unitPrice: 1000 },
      { description: "Materials allowance", qty: 1, unit: "lot", unitPrice: payBase },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 200 },
    ],
    Painter: [
      { description: "Labor – prep & masking", qty: Math.ceil(hrs / 2), unit: "hr", unitPrice: 55 },
      { description: "Labor – paint", qty: hrs, unit: "hr", unitPrice: 55 },
      { description: "Paint", qty: 5, unit: "gal", unitPrice: 45 },
      { description: "Primer", qty: 1, unit: "gal", unitPrice: 35 },
      { description: "Supplies", qty: 1, unit: "lot", unitPrice: 50 },
    ],
    Mason: [
      { description: "Labor", qty: hrs, unit: "hr", unitPrice: 80 },
      { description: "Block / brick", qty: 100, unit: "ea", unitPrice: 2.50 },
      { description: "Mortar mix", qty: 5, unit: "bag", unitPrice: 12 },
      { description: "Sand", qty: 0.5, unit: "ton", unitPrice: 80 },
    ],
    Welder: [
      { description: "Labor", qty: hrs, unit: "hr", unitPrice: 90 },
      { description: "Filler wire / rod", qty: 10, unit: "lb", unitPrice: 8 },
      { description: "Shielding gas", qty: 1, unit: "tank", unitPrice: 60 },
      { description: "Steel material", qty: 1, unit: "lot", unitPrice: payBase },
    ],
    Roofer: [
      { description: "Labor – tear-off", qty: Math.ceil(hrs / 2), unit: "hr", unitPrice: 65 },
      { description: "Labor – install", qty: hrs, unit: "hr", unitPrice: 65 },
      { description: "Architectural shingles", qty: 20, unit: "sq", unitPrice: 150 },
      { description: "Felt underlayment", qty: 10, unit: "sq", unitPrice: 25 },
      { description: "Flashing & accessories", qty: 1, unit: "lot", unitPrice: 120 },
      { description: "Permit", qty: 1, unit: "ea", unitPrice: 125 },
    ],
    Landscaper: [
      { description: "Labor", qty: hrs, unit: "hr", unitPrice: 45 },
      { description: "Plants & materials", qty: 1, unit: "lot", unitPrice: 300 },
      { description: "Mulch", qty: 5, unit: "cu yd", unitPrice: 55 },
      { description: "Equipment rental", qty: 1, unit: "day", unitPrice: 150 },
    ],
  };

  return (defaults[trade ?? ""] ?? [
    { description: "Labor", qty: hrs, unit: "hr", unitPrice: 65 },
    { description: "Materials", qty: 1, unit: "lot", unitPrice: payBase },
  ]);
}

function readTradForBid(): string | null {
  try { return JSON.parse(localStorage.getItem("rivt.profile.v1") ?? "null")?.primaryTrade ?? null; }
  catch { return null; }
}

interface BidLineItem {
  id: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
}

interface SavedBid {
  id: string;
  name: string;
  jobRef: string;
  markupPct: number;
  notes: string;
  lines: BidLineItem[];
  savedAt: string;
}

const bidStorageKey = "rivt.bids.v1";

function readSavedBids(): SavedBid[] {
  try {
    const stored = localStorage.getItem(bidStorageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SavedBid[];
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch { return []; }
}

function isSavedBid(value: unknown): value is SavedBid {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedBid>;
  return typeof candidate.id === "string"
    && typeof candidate.name === "string"
    && typeof candidate.jobRef === "string"
    && typeof candidate.markupPct === "number"
    && typeof candidate.notes === "string"
    && typeof candidate.savedAt === "string"
    && Array.isArray(candidate.lines);
}

function savedBidFromServer(record: ServerToolRecord): SavedBid | null {
  if (!isSavedBid(record.payload)) return null;
  return {
    ...record.payload,
    id: record.localId,
    name: record.payload.name || record.title,
    savedAt: record.payload.savedAt || record.updatedAt || new Date().toISOString(),
  };
}

function savedBidToServerInput(bid: SavedBid) {
  const subtotal = bid.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  const total = subtotal + subtotal * (bid.markupPct / 100);
  return {
    recordType: "bid" as const,
    localId: bid.id,
    title: bid.name || "Bid",
    status: "active",
    recordDate: bid.savedAt.slice(0, 10),
    amountCents: Math.round(Math.max(0, total) * 100),
    payload: { ...bid },
  };
}

function BidBuilderTool({ activeJob }: { activeJob: Job | null }) {
  const [lines, setLines] = useState<BidLineItem[]>(() =>
    getDefaultBidLines(readTradForBid(), activeJob?.durationHours, activeJob?.pay).map(l => ({ ...l, id: crypto.randomUUID() }))
  );
  const [markupPct, setMarkupPct] = useState(15);
  const [bidName, setBidName] = useState(activeJob ? `${activeJob.title} bid` : "New bid");
  const [jobRef, setJobRef] = useState(activeJob?.title ?? "");
  const [notes, setNotes] = useState("");
  const [savedBids, setSavedBids] = useState<SavedBid[]>(readSavedBids);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const [notice, setNotice] = useState("");
  const [bidAccepted, setBidAccepted] = useState(false);

  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
  const markup = subtotal * (markupPct / 100);
  const total = subtotal + markup;

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("bid").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Saved on this device. Sign in with network access to sync.");
        return;
      }
      const mapped = serverRecords.map(savedBidFromServer).filter((bid): bid is SavedBid => Boolean(bid));
      if (mapped.length) {
        const limited = mapped.slice(0, 10);
        setSavedBids(limited);
        try { localStorage.setItem(bidStorageKey, JSON.stringify(limited)); } catch { /* noop */ }
        setSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localSnapshot = readSavedBids();
      if (localSnapshot.length) {
        void Promise.all(localSnapshot.map((bid) => upsertToolRecord(savedBidToServerInput(bid)))).then((results) => {
          setSyncMessage(results.some(Boolean)
            ? "Local bids synced to your RIVT account."
            : "Saved on this device. Sync will retry when your account is reachable.");
        });
        return;
      }
      setSyncMessage("New bids sync to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, []);

  function persistSavedBids(next: SavedBid[], changedBid?: SavedBid) {
    const limited = next.slice(0, 10);
    setSavedBids(limited);
    try { localStorage.setItem(bidStorageKey, JSON.stringify(limited)); } catch { /* noop */ }
    if (!changedBid) return;
    void upsertToolRecord(savedBidToServerInput(changedBid)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Saved on this device. Sync will retry when your account is reachable.");
    });
  }

  function addLine() {
    setLines((prev) => [...prev, { id: crypto.randomUUID(), description: "", qty: 1, unit: "ea", unitPrice: 0 }]);
  }

  function updateLine(id: string, field: keyof BidLineItem, value: string | number) {
    setLines((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  function removeLine(id: string) {
    setLines((prev) => prev.length > 1 ? prev.filter((l) => l.id !== id) : prev);
  }

  function saveBid() {
    const bid: SavedBid = {
      id: crypto.randomUUID(),
      name: bidName.trim() || "Bid",
      jobRef: jobRef.trim(),
      markupPct,
      notes: notes.trim(),
      lines: lines.map((l) => ({ ...l, id: crypto.randomUUID() })),
      savedAt: new Date().toISOString(),
    };
    const next = [bid, ...savedBids.filter((b) => b.name.toLowerCase() !== bid.name.toLowerCase())].slice(0, 10);
    persistSavedBids(next, bid);
    setNotice("Bid saved.");
    setTimeout(() => setNotice(""), 3000);
  }

  function loadBid(bid: SavedBid) {
    setBidName(bid.name);
    setJobRef(bid.jobRef);
    setMarkupPct(bid.markupPct);
    setNotes(bid.notes);
    setLines(bid.lines.length ? bid.lines.map((l) => ({ ...l, id: crypto.randomUUID() })) : [{ id: crypto.randomUUID(), description: "", qty: 1, unit: "ea", unitPrice: 0 }]);
    setNotice(`Loaded "${bid.name}".`);
    setTimeout(() => setNotice(""), 3000);
  }

  function deleteBid(id: string) {
    const next = savedBids.filter((b) => b.id !== id);
    persistSavedBids(next);
    void deleteToolRecordByLocalId("bid", id).then((ok) => {
      setSyncMessage(ok ? "Deleted from this device and your RIVT account." : "Deleted on this device. Cloud sync will catch up when reachable.");
    });
  }

  function acceptBid() {
    try {
      const stored = localStorage.getItem("rivt.jobs.v1");
      const jobs: unknown[] = Array.isArray(JSON.parse(stored ?? "null")) ? (JSON.parse(stored!) as unknown[]) : [];
      const grandTotal = total;
      const newJob = {
        id: crypto.randomUUID(),
        title: bidName || "Untitled Job",
        status: "active",
        startDate: new Date().toISOString(),
        trade: "",
        location: "",
        description: `Accepted bid — total: $${grandTotal.toFixed(2)}`,
        bidTotal: grandTotal,
        source: "bid",
        createdAt: new Date().toISOString(),
      };
      jobs.push(newJob);
      localStorage.setItem("rivt.jobs.v1", JSON.stringify(jobs));
      setBidAccepted(true);
      setTimeout(() => setBidAccepted(false), 3000);
    } catch {
      // silently fail if localStorage is unavailable
    }
  }

  return (
    <div className="v2-tool-workbench v2-bid-workbench">
      <Panel className="v2-tool-panel v2-bid-builder-panel" eyebrow="Bid / quote" title="Build a bid">
        {savedBids.length ? (
          <div className="v2-bid-saved-list">
            {savedBids.map((bid) => (
              <article key={bid.id} className="v2-bid-saved-item">
                <span>
                  <strong>{bid.name}</strong>
                  <small>{bid.jobRef || "No job ref"} · {new Date(bid.savedAt).toLocaleDateString()}</small>
                </span>
                <button type="button" onClick={() => loadBid(bid)}>Load</button>
                <button type="button" aria-label={`Delete ${bid.name}`} onClick={() => deleteBid(bid.id)}><Trash2 size={14} /></button>
              </article>
            ))}
          </div>
        ) : null}
        {notice ? <p className="v2-record-notice" role="status">{notice}</p> : null}
        <p className="v2-record-notice" role="status">{syncMessage}</p>
        <div className="v2-tool-input-grid two">
          <label>Bid name<input value={bidName} onChange={(e) => setBidName(e.target.value)} placeholder="Roof replacement bid" /></label>
          <label>Job / client ref<input value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="Smith Residence, Job #42…" /></label>
        </div>
        <div className="v2-bid-line-table">
          <div className="v2-bid-line-header">
            <span>Description</span><span>Qty</span><span>Unit</span><span>Unit price</span><span>Total</span><span />
          </div>
          {lines.map((line) => (
            <div key={line.id} className="v2-bid-line">
              <input value={line.description} onChange={(e) => updateLine(line.id, "description", e.target.value)} placeholder="Item" aria-label="Description" />
              <input type="number" min="0" step="0.5" value={line.qty} onChange={(e) => updateLine(line.id, "qty", Number(e.target.value) || 0)} aria-label="Quantity" />
              <input value={line.unit} onChange={(e) => updateLine(line.id, "unit", e.target.value)} placeholder="hr" aria-label="Unit" />
              <input type="number" min="0" value={line.unitPrice} onChange={(e) => updateLine(line.id, "unitPrice", Number(e.target.value) || 0)} aria-label="Unit price" />
              <strong>{currency(line.qty * line.unitPrice)}</strong>
              <button type="button" aria-label="Remove line" onClick={() => removeLine(line.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" className="v2-bid-add-line" onClick={addLine}><Plus size={14} />Add line</button>
        </div>
        <div className="v2-bid-markup">
          <label>
            <span>Markup / overhead: {markupPct}%</span>
            <input type="range" min="0" max="50" step="1" value={markupPct} onChange={(e) => setMarkupPct(Number(e.target.value))} />
          </label>
        </div>
        <label>Notes for client<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Payment terms, exclusions, validity period…" /></label>
        <button type="button" className="v2-primary-button" onClick={saveBid}><FileText size={14} />Save bid to device</button>
      </Panel>

      <aside className="v2-bid-summary-stack">
        <Panel className="v2-tool-panel v2-tool-summary-panel" eyebrow="Bid total" title={currency(total)}>
          <div className="v2-tool-breakdown">
            <div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
            <div><span>Markup ({markupPct}%)</span><strong>{currency(markup)}</strong></div>
            <div><span>Total</span><strong>{currency(total)}</strong></div>
          </div>
          <div className="v2-bid-line-summary-list">
            {lines.map((l) => l.qty * l.unitPrice > 0 ? (
              <div key={l.id} className="v2-bid-line-summary">
                <span>{l.description || "Line"} ({l.qty} {l.unit})</span>
                <strong>{currency(l.qty * l.unitPrice)}</strong>
              </div>
            ) : null)}
          </div>
          {lines.some((l) => l.qty * l.unitPrice > 0) && total > 0 ? (
            bidAccepted ? (
              <div className="v2-bid-accepted-banner">✓ Job created! Open the Work tab to find it.</div>
            ) : (
              <button type="button" className="v2-bid-accept-btn" onClick={acceptBid}>
                <Briefcase size={16} />
                Accept Bid → Create Job
              </button>
            )
          ) : null}
        </Panel>
      </aside>
    </div>
  );
}

export { BidBuilderTool };
