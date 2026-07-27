import {
  Building2,
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
  contactDisplayName,
  contactMethodValue,
  createContact,
  fetchContact,
  fetchContacts,
  markContactUsed,
  updateContact,
  type ContactRecord,
  type ContactRole,
} from "../network/contacts-api";
import "./contact-picker.css";

interface ContactPickerProps {
  selectedContactId?: string | null;
  onSelect: (contact: ContactRecord | null) => void;
  role?: ContactRole;
  label?: string;
  helper?: string;
}

interface ContactDraft {
  entityType: "person" | "company";
  name: string;
  company: string;
  email: string;
  phone: string;
}

const roleLabels: Record<ContactRole, string> = {
  crew: "Crew",
  subcontractor: "Subcontractor",
  customer: "Customer",
  supplier: "Supplier",
  other: "Other",
};

function emptyDraft(query = "", role?: ContactRole): ContactDraft {
  return {
    entityType: role === "supplier" ? "company" : "person",
    name: query,
    company: "",
    email: "",
    phone: "",
  };
}

function contactSummary(contact: ContactRecord) {
  return [
    contactMethodValue(contact, "email"),
    contactMethodValue(contact, "phone"),
  ].filter(Boolean).join(" · ") || "No email or phone saved";
}

export function ContactPicker({
  selectedContactId = null,
  onSelect,
  role,
  label = role ? roleLabels[role] : "Contact",
  helper = role
    ? `Choose a saved ${roleLabels[role].toLowerCase()} or create one here.`
    : "Choose any saved person or company.",
}: ContactPickerProps) {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Loading contacts…");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ContactDraft>(() => emptyDraft("", role));
  const [saving, setSaving] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const hydratedSelectionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchContacts({ role, status: "active" }).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result) {
        setStatus("Contacts could not be loaded. Check your connection.");
        return;
      }
      setContacts(result);
      setStatus(result.length ? "Synced to your RIVT account." : "No matching contacts yet.");
    });
    return () => { cancelled = true; };
  }, [role]);

  const selected = contacts.find((contact) => contact.id === selectedContactId) ?? null;
  useEffect(() => {
    if (!selectedContactId) {
      hydratedSelectionRef.current = null;
      return;
    }
    if (selected && hydratedSelectionRef.current !== selected.id) {
      hydratedSelectionRef.current = selected.id;
      onSelect(selected);
      return;
    }
    if (selected || hydratedSelectionRef.current === selectedContactId) return;
    hydratedSelectionRef.current = selectedContactId;
    void fetchContact(selectedContactId).then((contact) => {
      if (!contact) return;
      setContacts((current) => [contact, ...current.filter((candidate) => candidate.id !== contact.id)]);
      onSelect(contact);
    });
  }, [onSelect, selected, selectedContactId]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? contacts.filter((contact) =>
          [
            contact.name,
            contact.company,
            ...contact.methods.map((method) => method.value),
            ...contact.tags,
          ].join(" ").toLowerCase().includes(needle))
      : contacts;
    return matches.slice(0, 12);
  }, [contacts, query]);

  async function choose(contact: ContactRecord) {
    onSelect(contact);
    setOpen(false);
    setCreating(false);
    setQuery("");
    const updated = await markContactUsed(contact.id);
    if (!updated) {
      setStatus("Contact selected. Recent-use order could not sync.");
      return;
    }
    setContacts((current) => [
      updated,
      ...current.filter((candidate) => candidate.id !== updated.id),
    ]);
    setStatus("Contact selected.");
  }

  async function createNewContact() {
    if (!draft.name.trim()) return;
    setSaving(true);
    setDuplicateId(null);
    const contactRole = role ?? "other";
    const result = await createContact({
      entityType: draft.entityType,
      name: draft.name.trim(),
      company: draft.company.trim(),
      notes: "",
      favorite: false,
      status: "active",
      roles: [{ role: contactRole, status: "active", details: {} }],
      methods: [
        ...(draft.email.trim() ? [{
          kind: "email" as const,
          label: "Primary",
          value: draft.email.trim().toLowerCase(),
          isPrimary: true,
        }] : []),
        ...(draft.phone.trim() ? [{
          kind: "phone" as const,
          label: "Primary",
          value: draft.phone.trim(),
          isPrimary: true,
        }] : []),
      ],
      addresses: [],
      tags: [],
    });
    setSaving(false);
    if (result.contact) {
      setContacts((current) => [result.contact!, ...current]);
      setDraft(emptyDraft("", role));
      await choose(result.contact);
      return;
    }
    if (result.duplicateCandidates[0]) {
      setDuplicateId(result.duplicateCandidates[0].id);
      setStatus("That email or phone already belongs to a saved contact.");
      return;
    }
    setStatus(result.error ?? "RIVT could not save this contact.");
  }

  async function chooseExistingDuplicate() {
    if (!duplicateId) return;
    setSaving(true);
    const existing = await fetchContact(duplicateId);
    if (!existing) {
      setSaving(false);
      setStatus("The matching contact could not be loaded.");
      return;
    }
    const contactRole = role ?? "other";
    const matchingRole = existing.roles.find((candidate) => candidate.role === contactRole);
    const roles = matchingRole
      ? existing.roles.map((candidate) => candidate.role === contactRole
          ? { ...candidate, status: "active" as const }
          : candidate)
      : [...existing.roles, { role: contactRole, status: "active" as const, details: {} }];
    const result = matchingRole?.status === "active"
      ? { contact: existing, error: null }
      : await updateContact(existing.id, { roles });
    setSaving(false);
    if (!result.contact) {
      setStatus(result.error ?? "The matching contact could not be updated.");
      return;
    }
    setContacts((current) => [result.contact!, ...current.filter((candidate) => candidate.id !== result.contact!.id)]);
    setDuplicateId(null);
    await choose(result.contact);
  }

  return (
    <section className="v2-contact-picker" aria-label={`${label} selection`}>
      <div className="v2-contact-picker-label">
        <span>{label}</span>
        <small>{selected ? "Saved contact" : helper}</small>
      </div>
      {selected ? (
        <div className="v2-contact-picker-selected">
          <span>{selected.entityType === "company" ? <Building2 size={19} /> : <UserRound size={19} />}</span>
          <span>
            <strong>{contactDisplayName(selected)}</strong>
            {selected.company ? <small>{selected.name}</small> : null}
            <small>{contactSummary(selected)}</small>
          </span>
          <button type="button" onClick={() => setOpen((current) => !current)}>Change</button>
        </div>
      ) : (
        <button type="button" className="v2-contact-picker-trigger" onClick={() => setOpen((current) => !current)}>
          <Search size={18} />
          <span><strong>Select a saved contact</strong><small>{helper}</small></span>
        </button>
      )}

      {open ? (
        <div className="v2-contact-picker-panel">
          <header>
            <div><strong>{role ? `${roleLabels[role]} contacts` : "Contacts"}</strong><small>{status}</small></div>
            <button type="button" aria-label="Close contact picker" onClick={() => setOpen(false)}><X size={18} /></button>
          </header>
          {!creating ? (
            <>
              <label className="v2-contact-picker-search">
                <Search size={17} />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, company, email, phone, or tag"
                />
              </label>
              <div className="v2-contact-picker-results" aria-live="polite">
                {loading ? <p>Loading contacts…</p> : visible.length ? visible.map((contact) => (
                  <button type="button" key={contact.id} onClick={() => void choose(contact)}>
                    <span>{contact.favorite ? <Star size={16} fill="currentColor" /> : contact.entityType === "company" ? <Building2 size={16} /> : <UserRound size={16} />}</span>
                    <span><strong>{contactDisplayName(contact)}</strong><small>{contactSummary(contact)}</small></span>
                    {contact.id === selectedContactId ? <Check size={17} /> : null}
                  </button>
                )) : <p>No contacts match that search.</p>}
              </div>
              <div className="v2-contact-picker-actions">
                <button type="button" onClick={() => {
                  setDraft(emptyDraft(query.trim(), role));
                  setDuplicateId(null);
                  setCreating(true);
                }}><Plus size={17} /> Create contact</button>
                <button type="button" onClick={() => {
                  onSelect(null);
                  setOpen(false);
                  setQuery("");
                }}>Clear selection</button>
              </div>
            </>
          ) : (
            <div className="v2-contact-picker-create">
              <div><strong>New {role ? roleLabels[role].toLowerCase() : "contact"}</strong><small>Save the details you actually have.</small></div>
              <div className="v2-contact-picker-create-grid">
                <label>Type<select value={draft.entityType} onChange={(event) => setDraft((current) => ({ ...current, entityType: event.target.value as ContactDraft["entityType"] }))}><option value="person">Person</option><option value="company">Company</option></select></label>
                <label>Name<input autoFocus value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
                <label>Company<input value={draft.company} onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))} /></label>
                <label><Mail size={14} /> Email<input type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /></label>
                <label><Phone size={14} /> Phone<input type="tel" value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} /></label>
              </div>
              {duplicateId ? (
                <div className="v2-contact-picker-duplicate" role="status">
                  <strong>This person or company is already saved.</strong>
                  <button type="button" onClick={() => void chooseExistingDuplicate()}>
                    Use existing{role ? ` and add ${roleLabels[role]} role` : ""}
                  </button>
                </div>
              ) : null}
              <div className="v2-contact-picker-create-actions">
                <button type="button" onClick={() => setCreating(false)}>Back</button>
                <button type="button" className="v2-primary-button" disabled={saving || !draft.name.trim()} onClick={() => void createNewContact()}>
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
