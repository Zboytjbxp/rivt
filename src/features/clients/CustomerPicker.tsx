import {
  Check,
  Mail,
  Phone,
  Plus,
  Search,
  Star,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  customerDisplayName,
  emptyClientRecord,
  markClientRecordUsed,
  saveClientRecord,
  saveClientRecordsLocal,
  syncClientRecords,
  type ClientRecord,
} from "./client-records";
import "./customer-picker.css";

interface CustomerPickerProps {
  selectedCustomerId?: string | null;
  onSelect: (customer: ClientRecord | null) => void;
  label?: string;
}

function contactSummary(customer: ClientRecord) {
  return [customer.email, customer.phone].filter(Boolean).join(" · ") || "No email or phone saved";
}

function normalizedPhone(value: string) {
  return value.replace(/\D/g, "");
}

export function CustomerPicker({
  selectedCustomerId = null,
  onSelect,
  label = "Customer",
}: CustomerPickerProps) {
  const [customers, setCustomers] = useState<ClientRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading saved customers…");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(() => emptyClientRecord());
  const [saving, setSaving] = useState(false);
  const hydratedSelectionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void syncClientRecords().then((result) => {
      if (cancelled) return;
      setCustomers(result.clients);
      setStatus(result.message);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const selected = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  useEffect(() => {
    if (!selectedCustomerId) {
      hydratedSelectionRef.current = null;
      return;
    }
    if (!selected || hydratedSelectionRef.current === selected.id) return;
    hydratedSelectionRef.current = selected.id;
    onSelect(selected);
  }, [onSelect, selected, selectedCustomerId]);
  const visibleCustomers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return customers.slice(0, 8);
    return customers.filter((customer) =>
      `${customer.name} ${customer.company} ${customer.email} ${customer.phone}`
        .toLowerCase()
        .includes(needle)
    ).slice(0, 12);
  }, [customers, query]);
  const duplicate = useMemo(() => {
    const email = draft.email.trim().toLowerCase();
    const phone = normalizedPhone(draft.phone);
    return customers.find((customer) =>
      Boolean(email && customer.email.toLowerCase() === email)
      || Boolean(phone.length >= 7 && normalizedPhone(customer.phone) === phone)
    ) ?? null;
  }, [customers, draft.email, draft.phone]);

  async function choose(customer: ClientRecord) {
    onSelect(customer);
    setOpen(false);
    setCreating(false);
    setQuery("");
    const updated = await markClientRecordUsed(customer);
    if (!updated) {
      setStatus("Customer selected. Recent-use order could not sync.");
      return;
    }
    setStatus("Customer selected and recent-use order synced.");
    setCustomers((current) => {
      const next = current
        .map((candidate) => candidate.id === updated.id ? updated : candidate)
        .sort((left, right) => new Date(right.lastUsedAt ?? right.updatedAt).getTime() - new Date(left.lastUsedAt ?? left.updatedAt).getTime());
      saveClientRecordsLocal(next);
      return next;
    });
  }

  async function createCustomer() {
    if (!draft.name.trim() || duplicate) return;
    setSaving(true);
    const saved = await saveClientRecord({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
    setSaving(false);
    if (!saved) {
      setStatus("Could not sync this customer. Check your connection and try again.");
      return;
    }
    const next = [saved, ...customers];
    setCustomers(next);
    saveClientRecordsLocal(next);
    setDraft(emptyClientRecord());
    setCreating(false);
    setStatus("Customer saved to your RIVT account.");
    await choose(saved);
  }

  function useOnce() {
    onSelect(null);
    setOpen(false);
    setCreating(false);
    setQuery("");
  }

  return (
    <section className="v2-customer-picker" aria-label={`${label} selection`}>
      <div className="v2-customer-picker-label">
        <span>{label}</span>
        {selected ? <small>Saved customer</small> : <small>Optional customer book link</small>}
      </div>
      {selected ? (
        <div className="v2-customer-picker-selected">
          <span className="v2-customer-picker-avatar"><UserRound size={19} /></span>
          <span>
            <strong>{customerDisplayName(selected)}</strong>
            {selected.company ? <small>{selected.name}</small> : null}
            <small>{contactSummary(selected)}</small>
          </span>
          <button type="button" onClick={() => setOpen((current) => !current)}>
            Change
          </button>
        </div>
      ) : (
        <button type="button" className="v2-customer-picker-trigger" onClick={() => setOpen((current) => !current)}>
          <Search size={18} />
          <span><strong>Select a saved customer</strong><small>Search or create without leaving this form</small></span>
        </button>
      )}

      {open ? (
        <div className="v2-customer-picker-panel">
          <header>
            <div><strong>Customer book</strong><small>{status}</small></div>
            <button type="button" aria-label="Close customer picker" onClick={() => setOpen(false)}><X size={18} /></button>
          </header>

          {!creating ? (
            <>
              <label className="v2-customer-picker-search">
                <Search size={17} />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, company, email, or phone"
                />
              </label>
              <div className="v2-customer-picker-results" aria-live="polite">
                {loading ? <p>Loading customers…</p> : visibleCustomers.length ? visibleCustomers.map((customer) => (
                  <button type="button" key={customer.id} onClick={() => void choose(customer)}>
                    <span className="v2-customer-result-icon">{customer.favorite ? <Star size={16} fill="currentColor" /> : <UserRound size={16} />}</span>
                    <span>
                      <strong>{customerDisplayName(customer)}</strong>
                      <small>{customer.company ? `${customer.name} · ` : ""}{contactSummary(customer)}</small>
                    </span>
                    {customer.id === selectedCustomerId ? <Check size={17} /> : null}
                  </button>
                )) : <p>No saved customers match that search.</p>}
              </div>
              <div className="v2-customer-picker-actions">
                <button type="button" onClick={() => {
                  setDraft(emptyClientRecord(query.trim()));
                  setCreating(true);
                }}><Plus size={17} /> Create new customer</button>
                <button type="button" onClick={useOnce}>Use entered details once</button>
              </div>
            </>
          ) : (
            <div className="v2-customer-picker-create">
              <div className="v2-customer-picker-create-title">
                <strong>New customer</strong>
                <small>Only a name is required. Add the contact detail you actually have.</small>
              </div>
              <div className="v2-customer-picker-create-grid">
                <label>Name<input autoFocus value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Company<input value={draft.company} onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))} /></label>
                <label><Mail size={14} /> Email<input type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /></label>
                <label><Phone size={14} /> Phone<input type="tel" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} /></label>
              </div>
              {duplicate ? (
                <div className="v2-customer-picker-duplicate" role="status">
                  <strong>That contact is already saved as {customerDisplayName(duplicate)}.</strong>
                  <button type="button" onClick={() => void choose(duplicate)}>Use existing customer</button>
                </div>
              ) : null}
              <div className="v2-customer-picker-create-actions">
                <button type="button" onClick={() => setCreating(false)}>Back</button>
                <button type="button" className="v2-primary-button" disabled={saving || !draft.name.trim() || Boolean(duplicate)} onClick={() => void createCustomer()}>
                  {saving ? "Saving…" : "Save and use"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
