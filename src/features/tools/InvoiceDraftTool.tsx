import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, FileText, Mail, MessageSquare, Plus, Save, Trash2 } from "lucide-react";
import type { Job } from "../../types";
import { Panel } from "../../components/ui";
import { readPrimaryHourlyRate } from "../../lib/rateCard";
import type { EstimateInvoiceDraft } from "./EstimateTool";
import { clampNumber, currency, formatQuantity, toCents, centsToDollars } from "./money";
import { getInvoiceLinePriceSignal } from "./priceGuidance";
import { deleteToolRecordByLocalId, fetchToolRecords, sendInvoiceByLocalId, upsertToolRecord, type ServerToolRecord, type ToolRecordInput } from "./tool-records-api";
import {
  createProjectInvoice,
  getProjectForActiveWork,
  recordProjectInvoicePayment,
  updateProjectInvoiceStatus,
  type ProjectInvoice,
} from "./project-api";
import { toolContextLabel, toolContextRecordFields, toolContextStorageId, type ToolWorkContext } from "./tool-work-context";

function numericValue(value: number, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function lineTotalCents(line: InvoiceLine) {
  return toCents(numericValue(line.qty) * numericValue(line.rate));
}

interface InvoiceLine {
  id: string;
  description: string;
  qty: number;
  rate: number;
  kind?: "labor" | "material" | "other" | "adjustment";
}

interface InvoiceTemplate {
  id: string;
  name: string;
  savedAt: string;
  invoiceNumber: string;
  billTo: string;
  payTo: string;
  terms: string;
  paymentMethod: string;
  recipientEmail: string;
  recipientPhone: string;
  taxPct: number;
  lines: InvoiceLine[];
}

const invoiceTemplateStorageKey = "rivt.invoiceTemplates.v1";
const invoicePrefsStorageKey = "rivt.invoicePrefs.v1";

interface InvoiceDraftSnapshot {
  invoiceNumber: string;
  billTo: string;
  payTo: string;
  terms: string;
  paymentMethod: string;
  recipientEmail: string;
  recipientPhone: string;
  taxPct: number;
  templateName: string;
  lines: InvoiceLine[];
}

function invoiceDraftStorageKey(context: ToolWorkContext) {
  return `rivt.invoiceDraft.v2:${toolContextStorageId(context)}`;
}

function readInvoiceDraft(context: ToolWorkContext): Partial<InvoiceDraftSnapshot> {
  try {
    const parsed = JSON.parse(localStorage.getItem(invoiceDraftStorageKey(context)) || "{}") as Partial<InvoiceDraftSnapshot>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

interface InvoicePrefs {
  payTo: string;
  terms: string;
  paymentMethod: string;
  recipientEmail: string;
  recipientPhone: string;
  taxPct: number;
}

function readInvoicePrefs(): InvoicePrefs {
  const fallback: InvoicePrefs = {
    payTo: "",
    terms: "Due on completion",
    paymentMethod: "Direct payment",
    recipientEmail: "",
    recipientPhone: "",
    taxPct: 0,
  };
  try {
    const stored = localStorage.getItem(invoicePrefsStorageKey);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<InvoicePrefs>;
    return {
      payTo: typeof parsed.payTo === "string" ? parsed.payTo : fallback.payTo,
      terms: typeof parsed.terms === "string" && parsed.terms.trim() ? parsed.terms : fallback.terms,
      paymentMethod: typeof parsed.paymentMethod === "string" && parsed.paymentMethod.trim() ? parsed.paymentMethod : fallback.paymentMethod,
      recipientEmail: typeof parsed.recipientEmail === "string" ? parsed.recipientEmail : fallback.recipientEmail,
      recipientPhone: typeof parsed.recipientPhone === "string" ? parsed.recipientPhone : fallback.recipientPhone,
      taxPct: clampNumber(Number(parsed.taxPct), fallback.taxPct),
    };
  } catch {
    return fallback;
  }
}

function readInvoiceTemplates() {
  try {
    const stored = localStorage.getItem(invoiceTemplateStorageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as InvoiceTemplate[];
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function isInvoiceTemplate(value: unknown): value is InvoiceTemplate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InvoiceTemplate>;
  return typeof candidate.id === "string"
    && typeof candidate.name === "string"
    && typeof candidate.savedAt === "string"
    && typeof candidate.invoiceNumber === "string"
    && typeof candidate.billTo === "string"
    && typeof candidate.payTo === "string"
    && typeof candidate.terms === "string"
    && typeof candidate.paymentMethod === "string"
    && typeof candidate.recipientEmail === "string"
    && typeof candidate.recipientPhone === "string"
    && typeof candidate.taxPct === "number"
    && Array.isArray(candidate.lines);
}

function invoiceTemplateFromServer(record: ServerToolRecord): InvoiceTemplate | null {
  if (!isInvoiceTemplate(record.payload)) return null;
  return {
    ...record.payload,
    id: record.localId,
    name: record.payload.name || record.title,
    savedAt: record.payload.savedAt || record.updatedAt || new Date().toISOString(),
  };
}

function invoiceTemplateToServerInput(template: InvoiceTemplate) {
  return {
    recordType: "invoice_template" as const,
    localId: template.id,
    title: template.name || "Invoice template",
    status: "active",
    recordDate: template.savedAt.slice(0, 10),
    amountCents: null,
    payload: { ...template },
  };
}

function defaultInvoiceLines(activeJob: Job | null): InvoiceLine[] {
  const savedHourlyRate = readPrimaryHourlyRate(65);
  return [
    { id: "labor", description: "Labor", qty: activeJob?.durationHours ?? 8, rate: activeJob ? Math.max(savedHourlyRate, Math.round(activeJob.pay / Math.max(1, activeJob.durationHours) * 0.78)) : savedHourlyRate, kind: "labor" },
    { id: "materials", description: "Materials", qty: 1, rate: activeJob ? Math.max(50, Math.round(activeJob.pay * 0.2)) : 250, kind: "material" },
  ];
}

function invoiceLinesFromEstimate(draft: EstimateInvoiceDraft): InvoiceLine[] {
  return draft.lines.length
    ? draft.lines.map((line) => ({ ...line, id: crypto.randomUUID() }))
    : [{ id: crypto.randomUUID(), description: "Converted estimate", qty: 1, rate: 0 }];
}

export function InvoiceDraftTool({
  activeJob,
  workContext,
  estimateDraft = null,
  activeWorkId = null,
}: {
  activeJob: Job | null;
  workContext: ToolWorkContext;
  estimateDraft?: EstimateInvoiceDraft | null;
  activeWorkId?: string | null;
}) {
  const [invoicePrefs] = useState(readInvoicePrefs);
  const [initialDraft] = useState(() => readInvoiceDraft(workContext));
  const [invoiceNumber, setInvoiceNumber] = useState(estimateDraft?.invoiceNumber ?? initialDraft.invoiceNumber ?? (activeJob ? `RIVT-${activeJob.id}` : `RIVT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`));
  const initialProjectInvoiceNumber = useRef(estimateDraft?.invoiceNumber ?? (activeJob ? `RIVT-${activeJob.id}` : "RIVT-DRAFT"));
  const [billTo, setBillTo] = useState(
    estimateDraft?.billTo
      || initialDraft.billTo
      || activeJob?.contractor
      || (workContext.kind === "standalone" ? workContext.project.clientName : ""),
  );
  const [payTo, setPayTo] = useState(initialDraft.payTo ?? invoicePrefs.payTo);
  const [terms, setTerms] = useState(estimateDraft?.terms ?? initialDraft.terms ?? invoicePrefs.terms);
  const [paymentMethod, setPaymentMethod] = useState(estimateDraft?.paymentMethod ?? initialDraft.paymentMethod ?? invoicePrefs.paymentMethod);
  const [recipientEmail, setRecipientEmail] = useState(initialDraft.recipientEmail ?? invoicePrefs.recipientEmail);
  const [recipientPhone, setRecipientPhone] = useState(initialDraft.recipientPhone ?? invoicePrefs.recipientPhone);
  const [taxPct, setTaxPct] = useState(initialDraft.taxPct ?? invoicePrefs.taxPct);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(readInvoiceTemplates);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const [templateName, setTemplateName] = useState(estimateDraft?.templateName ?? initialDraft.templateName ?? (activeJob ? `${activeJob.title} invoice` : "Standard invoice"));
  const [templateNotice, setTemplateNotice] = useState("");
  const [conversionNotice, setConversionNotice] = useState(estimateDraft?.sourceNote ?? "");
  const [lines, setLines] = useState<InvoiceLine[]>(() => estimateDraft
    ? invoiceLinesFromEstimate(estimateDraft)
    : initialDraft.lines?.length
      ? initialDraft.lines.map((line) => ({ ...line, id: crypto.randomUUID() }))
      : defaultInvoiceLines(activeJob));
  const [draftSaveMessage, setDraftSaveMessage] = useState("Autosaved on this device.");
  const [projectInvoice, setProjectInvoice] = useState<ProjectInvoice | null>(null);
  const [projectInvoiceBusy, setProjectInvoiceBusy] = useState(false);
  const [projectInvoiceNotice, setProjectInvoiceNotice] = useState("");
  const [projectInvoiceError, setProjectInvoiceError] = useState("");
  const [invoiceEmailBusy, setInvoiceEmailBusy] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethodDraft, setPaymentMethodDraft] = useState("Direct payment");
  const [paymentNote, setPaymentNote] = useState("");
  const [step, setStep] = useState<"items" | "customer" | "review">("items");

  const subtotalCents = lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
  const taxCents = Math.round(subtotalCents * (numericValue(taxPct) / 100));
  const totalCents = subtotalCents + taxCents;
  const subtotal = centsToDollars(subtotalCents);
  const tax = centsToDollars(taxCents);
  const total = centsToDollars(totalCents);
  const lineSignals = lines.map((line) => {
    const isHourlyLabor = line.kind === "labor";
    return {
      lineId: line.id,
      signal: isHourlyLabor ? getInvoiceLinePriceSignal({
      description: line.description,
      qty: numericValue(line.qty),
      rate: numericValue(line.rate),
      trade: activeJob?.trade ?? null,
      }) : null,
    };
  });
  const primarySignal =
    lineSignals.find(({ signal }) => signal && signal.tone !== "unknown")?.signal ??
    lineSignals.find(({ signal }) => signal)?.signal;

  const invoiceText = useMemo(() => [
    `RIVT invoice draft ${invoiceNumber}`,
    `Work: ${toolContextLabel(workContext)}`,
    `Bill to: ${billTo || "Not entered"}`,
    `Pay to: ${payTo || "Not entered"}`,
    "",
    ...lines.map((line) => `${line.description || "Line item"} - ${formatQuantity(line.qty)} x ${currency(line.rate)} = ${currency(centsToDollars(lineTotalCents(line)))}`),
    "",
    `Subtotal: ${currency(subtotal)}`,
    `Tax: ${currency(tax)}`,
    `Total due: ${currency(total)}`,
    `Terms: ${terms}`,
    `Payment method: ${paymentMethod}`,
    "RIVT records direct-payment details only. RIVT does not process, escrow, or hold job payments.",
  ].join("\n"), [billTo, invoiceNumber, lines, paymentMethod, payTo, subtotal, tax, terms, total, workContext]);
  const smsHref = `sms:${encodeURIComponent(recipientPhone)}?body=${encodeURIComponent(`RIVT invoice ${invoiceNumber}: ${currency(total)} due. ${terms}. ${paymentMethod}.`)}`;

  useEffect(() => {
    if (!activeWorkId) return;
    let cancelled = false;
    void getProjectForActiveWork(activeWorkId)
      .then((project) => {
        if (cancelled) return;
        const existing = project.invoices.find((invoice) => invoice.invoiceNumber === initialProjectInvoiceNumber.current) ?? null;
        setProjectInvoice(existing);
        if (existing) setPaymentAmount((existing.balanceCents / 100).toFixed(2));
      })
      .catch(() => {
        // A project is created only when the participant intentionally saves a job invoice.
      });
    return () => { cancelled = true; };
  }, [activeWorkId]);

  useEffect(() => {
    try {
      localStorage.setItem(invoicePrefsStorageKey, JSON.stringify({
        payTo,
        terms,
        paymentMethod,
        recipientEmail,
        recipientPhone,
        taxPct,
      }));
    } catch {
      // Invoice defaults are a convenience only; templates and manual entry still work.
    }
  }, [paymentMethod, payTo, recipientEmail, recipientPhone, taxPct, terms]);

  useEffect(() => {
    const snapshot: InvoiceDraftSnapshot = { invoiceNumber, billTo, payTo, terms, paymentMethod, recipientEmail, recipientPhone, taxPct, templateName, lines };
    try {
      localStorage.setItem(invoiceDraftStorageKey(workContext), JSON.stringify(snapshot));
    } catch {
      // The in-memory invoice remains usable when device storage is unavailable.
    }
  }, [billTo, invoiceNumber, lines, paymentMethod, payTo, recipientEmail, recipientPhone, taxPct, templateName, terms, workContext]);

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("invoice_template").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setSyncMessage("Saved on this device. Sign in with network access to sync.");
        return;
      }
      const mapped = serverRecords.map(invoiceTemplateFromServer).filter((template): template is InvoiceTemplate => Boolean(template));
      if (mapped.length) {
        const limited = mapped.slice(0, 8);
        setTemplates(limited);
        try { localStorage.setItem(invoiceTemplateStorageKey, JSON.stringify(limited)); } catch { /* noop */ }
        setSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localSnapshot = readInvoiceTemplates();
      if (localSnapshot.length) {
        void Promise.all(localSnapshot.map((template) => upsertToolRecord(invoiceTemplateToServerInput(template)))).then((results) => {
        setSyncMessage(results.some(Boolean)
            ? "Local invoice templates synced to your RIVT account."
            : "Couldn't sync - saved on this device only.");
        });
        return;
      }
      setSyncMessage("New invoice templates sync to your RIVT account.");
    });
    return () => { cancelled = true; };
  }, []);

  function updateLine(id: string, field: keyof InvoiceLine, value: string | number) {
    setLines((current) => current.map((line) => {
      if (line.id !== id) return line;
      if (field === "qty" || field === "rate") {
        return { ...line, [field]: clampNumber(Number(value) || 0) };
      }
      return { ...line, [field]: value };
    }));
  }

  function addLine() {
    setLines((current) => [...current, { id: crypto.randomUUID(), description: "", qty: 1, rate: 0, kind: "other" }]);
  }

  function removeLine(id: string) {
    setLines((current) => current.length > 1 ? current.filter((line) => line.id !== id) : current);
  }

  function persistTemplates(nextTemplates: InvoiceTemplate[], notice: string, changedTemplate?: InvoiceTemplate) {
    const limited = nextTemplates.slice(0, 8);
    setTemplates(limited);
    setTemplateNotice(notice);
    try {
      localStorage.setItem(invoiceTemplateStorageKey, JSON.stringify(limited));
    } catch {
      setTemplateNotice("Template could not be saved on this device.");
    }
    if (!changedTemplate) return;
    void upsertToolRecord(invoiceTemplateToServerInput(changedTemplate)).then((record) => {
      setSyncMessage(record ? "Synced to your RIVT account." : "Couldn't sync - saved on this device only.");
    });
  }

  function saveTemplate() {
    const cleanName = templateName.trim() || "Invoice template";
    const template: InvoiceTemplate = {
      id: crypto.randomUUID(),
      name: cleanName,
      savedAt: new Date().toISOString(),
      invoiceNumber,
      billTo,
      payTo,
      terms,
      paymentMethod,
      recipientEmail,
      recipientPhone,
      taxPct,
      lines: lines.map((line) => ({ ...line, id: crypto.randomUUID() })),
    };
    persistTemplates([template, ...templates.filter((item) => item.name.toLowerCase() !== cleanName.toLowerCase())], "Template saved.", template);
  }

  function loadTemplate(template: InvoiceTemplate) {
    setTemplateName(template.name);
    setInvoiceNumber(template.invoiceNumber);
    setBillTo(template.billTo);
    setPayTo(template.payTo);
    setTerms(template.terms);
    setPaymentMethod(template.paymentMethod);
    setRecipientEmail(template.recipientEmail);
    setRecipientPhone(template.recipientPhone);
    setTaxPct(template.taxPct);
    setLines(template.lines.length ? template.lines.map((line) => ({ ...line, id: crypto.randomUUID() })) : [{ id: crypto.randomUUID(), description: "", qty: 1, rate: 0, kind: "other" }]);
    setTemplateNotice(`Loaded ${template.name}.`);
  }

  function deleteTemplate(templateId: string) {
    persistTemplates(templates.filter((template) => template.id !== templateId), "Template removed from this device.");
    void deleteToolRecordByLocalId("invoice_template", templateId).then((ok) => {
      setSyncMessage(ok ? "Deleted from this device and your RIVT account." : "Deleted on this device only. Could not sync deletion.");
    });
  }

  function startBlankInvoice() {
    const latestPrefs = readInvoicePrefs();
    setInvoiceNumber(`RIVT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
    setBillTo("");
    setPayTo(latestPrefs.payTo);
    setTerms(latestPrefs.terms);
    setPaymentMethod(latestPrefs.paymentMethod);
    setRecipientEmail(latestPrefs.recipientEmail);
    setRecipientPhone(latestPrefs.recipientPhone);
    setTaxPct(latestPrefs.taxPct);
    setTemplateName("Standard invoice");
    setLines(defaultInvoiceLines(null));
    setConversionNotice("");
    setTemplateNotice("Blank invoice started.");
    setProjectInvoice(null);
    setProjectInvoiceNotice("");
    setProjectInvoiceError("");
  }

  function projectInvoiceInput() {
    return {
      invoiceNumber: invoiceNumber.trim() || "RIVT-DRAFT",
      billTo: billTo.trim(),
      payTo: payTo.trim(),
      terms: terms.trim(),
      paymentMethod: paymentMethod.trim(),
      recipientEmail: recipientEmail.trim(),
      recipientPhone: recipientPhone.trim(),
      taxCents,
      lineItems: lines.map((line) => ({
        description: line.description.trim() || "Line item",
        quantity: numericValue(line.qty),
        rateCents: toCents(numericValue(line.rate)),
        kind: line.kind ?? "other",
      })),
      sourceEstimate: estimateDraft
        ? { source: "estimate", sourceNote: estimateDraft.sourceNote, convertedAt: new Date().toISOString() }
        : {},
    };
  }

  function invoiceToolRecordInput(): ToolRecordInput {
    const snapshot: InvoiceDraftSnapshot = { invoiceNumber, billTo, payTo, terms, paymentMethod, recipientEmail, recipientPhone, taxPct, templateName, lines };
    return {
      recordType: "invoice_draft",
      localId: `invoice:${toolContextStorageId(workContext)}`,
      title: `${invoiceNumber || "RIVT-DRAFT"} - ${toolContextLabel(workContext)}`,
      status: "draft",
      recordDate: new Date().toISOString().slice(0, 10),
      amountCents: totalCents,
      payload: {
        ...snapshot,
        recipientName: billTo.trim(),
        workLabel: toolContextLabel(workContext),
        customerLines: lines.map((line) => ({
          description: line.description.trim() || "Line item",
          quantity: numericValue(line.qty),
          totalCents: lineTotalCents(line),
        })),
      },
      ...toolContextRecordFields(workContext),
    };
  }

  async function saveInvoiceDraft(): Promise<ServerToolRecord | null> {
    const record = await upsertToolRecord(invoiceToolRecordInput());
    if (!record) {
      setDraftSaveMessage("Draft kept on this device. RIVT account sync failed.");
      return null;
    }
    if (activeWorkId && !projectInvoice) {
      const savedToWork = await saveToActiveWork();
      setDraftSaveMessage(savedToWork ? "Draft saved to this job and your RIVT account." : "Draft saved to your RIVT account. It could not be added to the job workspace.");
      return record;
    }
    setDraftSaveMessage(activeWorkId ? "Draft saved to this job and your RIVT account." : "Draft saved to your RIVT account.");
    return record;
  }

  async function saveToActiveWork() {
    if (!activeWorkId) return false;
    setProjectInvoiceBusy(true);
    setProjectInvoiceError("");
    setProjectInvoiceNotice("");
    try {
      const saved = await createProjectInvoice(activeWorkId, projectInvoiceInput());
      setProjectInvoice(saved);
      setPaymentAmount((saved.balanceCents / 100).toFixed(2));
      setProjectInvoiceNotice("Invoice saved to this job workspace.");
      return true;
    } catch (error) {
      setProjectInvoiceError(error instanceof Error ? error.message : "RIVT could not save this invoice to the job.");
      return false;
    } finally {
      setProjectInvoiceBusy(false);
    }
  }

  async function markProjectInvoiceSent() {
    if (!projectInvoice) return;
    setProjectInvoiceBusy(true);
    setProjectInvoiceError("");
    setProjectInvoiceNotice("");
    try {
      const updated = await updateProjectInvoiceStatus(projectInvoice.id, "sent");
      setProjectInvoice(updated);
      setProjectInvoiceNotice("Marked sent in the shared job record.");
    } catch (error) {
      setProjectInvoiceError(error instanceof Error ? error.message : "RIVT could not update this invoice.");
    } finally {
      setProjectInvoiceBusy(false);
    }
  }

  async function recordExternalPayment() {
    if (!projectInvoice) return;
    const amountCents = toCents(Math.max(0, Number(paymentAmount) || 0));
    if (!amountCents) {
      setProjectInvoiceError("Enter the amount received before recording an external payment.");
      return;
    }
    setProjectInvoiceBusy(true);
    setProjectInvoiceError("");
    setProjectInvoiceNotice("");
    try {
      const updated = await recordProjectInvoicePayment(projectInvoice.id, {
        amountCents,
        paymentDate: new Date().toISOString().slice(0, 10),
        method: paymentMethodDraft.trim() || "Direct payment",
        note: paymentNote.trim(),
      });
      setProjectInvoice(updated);
      setPaymentAmount((updated.balanceCents / 100).toFixed(2));
      setPaymentNote("");
      setProjectInvoiceNotice(updated.balanceCents === 0 ? "Invoice marked paid from the recorded external payments." : "External payment recorded in the shared job record.");
    } catch (error) {
      setProjectInvoiceError(error instanceof Error ? error.message : "RIVT could not record that payment.");
    } finally {
      setProjectInvoiceBusy(false);
    }
  }

  async function copyInvoice() {
    try {
      await navigator.clipboard.writeText(invoiceText);
      setDraftSaveMessage("Invoice copied.");
    } catch {
      setDraftSaveMessage("Copy failed. Select the invoice text and try again.");
    }
  }

  function printInvoice() {
    window.print();
  }

  async function emailInvoice() {
    if (!recipientEmail.trim()) {
      setStep("customer");
      setDraftSaveMessage("Add a customer email before sending.");
      return;
    }
    if (!totalCents) {
      setStep("items");
      setDraftSaveMessage("Add at least one priced line before sending.");
      return;
    }
    setInvoiceEmailBusy(true);
    const record = await saveInvoiceDraft();
    if (!record) {
      setInvoiceEmailBusy(false);
      return;
    }
    try {
      const sent = await sendInvoiceByLocalId(record.localId);
      const delivery = sent.payload.delivery;
      const recipient = delivery
        && typeof delivery === "object"
        && "recipientEmail" in delivery
        && typeof delivery.recipientEmail === "string"
        ? delivery.recipientEmail
        : recipientEmail.trim();
      setDraftSaveMessage(`Invoice emailed to ${recipient}.`);
    } catch (error) {
      setDraftSaveMessage(error instanceof Error ? error.message : "RIVT could not send the invoice.");
    } finally {
      setInvoiceEmailBusy(false);
    }
  }

  return (
    <div className={`v2-tool-workbench v2-invoice-workbench is-${step}`}>
      <nav className="v2-tool-flow-nav" aria-label="Invoice draft steps">
        {(["items", "customer", "review"] as const).map((item, index) => (
          <button key={item} type="button" aria-current={step === item ? "step" : undefined} onClick={() => setStep(item)}>
            <span>{index + 1}</span>{item === "items" ? "Items" : item === "customer" ? "Customer" : "Review"}
          </button>
        ))}
      </nav>
      <Panel className="v2-tool-panel v2-invoice-builder-panel" eyebrow={`Step ${step === "items" ? 1 : step === "customer" ? 2 : 3} of 3`} title={step === "items" ? "Build the invoice" : step === "customer" ? "Add the customer" : "Preview and deliver"}>
        <section className="v2-invoice-topline" aria-label="Invoice summary">
          <div>
            <span>Total due</span>
            <strong>{currency(total)}</strong>
            <small>{invoiceNumber || "RIVT-DRAFT"} / {terms}</small>
          </div>
        </section>

        {step === "review" && activeWorkId ? (
          <section className="v2-invoice-project-record" aria-label="Job invoice record">
            <div>
              <span>Job invoice record</span>
              <strong>{projectInvoice ? `${projectInvoice.status} - ${currency(projectInvoice.balanceCents / 100)} remaining` : "Not saved to this job yet"}</strong>
              <small>RIVT records external payments only. It does not collect, hold, or confirm funds.</small>
            </div>
            <div className="v2-tool-action-row">
              <button type="button" className="v2-primary-button" onClick={() => void saveToActiveWork()} disabled={projectInvoiceBusy || totalCents <= 0 || Boolean(projectInvoice)}>
                {projectInvoiceBusy ? "Saving..." : projectInvoice ? "Saved to job" : "Save to job"}
              </button>
              {projectInvoice ? <button type="button" onClick={startBlankInvoice} disabled={projectInvoiceBusy}>New invoice</button> : null}
              {projectInvoice && projectInvoice.status === "draft" ? <button type="button" onClick={() => void markProjectInvoiceSent()} disabled={projectInvoiceBusy}>Mark sent</button> : null}
            </div>
            {projectInvoice ? (
              <div className="v2-invoice-payment-record">
                <label>Amount received<input inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} aria-label="External payment amount" /></label>
                <label>Method<input value={paymentMethodDraft} onChange={(event) => setPaymentMethodDraft(event.target.value)} /></label>
                <label>Note<input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Optional reference" /></label>
                <button type="button" onClick={() => void recordExternalPayment()} disabled={projectInvoiceBusy || projectInvoice.status === "void" || projectInvoice.balanceCents <= 0}>Record external payment</button>
              </div>
            ) : null}
            {projectInvoiceNotice ? <p className="v2-record-notice" role="status">{projectInvoiceNotice}</p> : null}
            {projectInvoiceError ? <p className="v2-record-error" role="alert">{projectInvoiceError}</p> : null}
          </section>
        ) : null}

        {step === "items" && conversionNotice ? (
          <div className="v2-converted-estimate-note" role="status">
            <p>{conversionNotice}</p>
            <span>
              <button type="button" onClick={() => setConversionNotice("")}>Dismiss</button>
              <button type="button" onClick={startBlankInvoice}>Start blank invoice</button>
            </span>
          </div>
        ) : null}
        {step === "items" ? <details className="v2-tool-collapsible v2-invoice-template-tools" aria-label="Invoice templates">
          <summary>
            <span>Templates</span>
            <small>{templates.length ? `${templates.length} saved` : "Optional"}</small>
          </summary>
        <section className="v2-invoice-template-bar">
          <label>Template name<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Standard labor invoice" /></label>
          <button type="button" className="v2-primary-button" onClick={saveTemplate}><FileText size={14} />Save template</button>
          <small>{syncMessage}</small>
        </section>
        {templateNotice ? <p className="v2-record-notice" role="status">{templateNotice}</p> : null}
        {templates.length ? (
            <div className="v2-invoice-template-list">
              {templates.map((template) => (
                <article key={template.id}>
                  <span>
                    <strong>{template.name}</strong>
                    <small>Saved {new Date(template.savedAt).toLocaleDateString()}</small>
                  </span>
                  <button type="button" onClick={() => loadTemplate(template)}>Load</button>
                  <button type="button" aria-label={`Delete ${template.name}`} onClick={() => deleteTemplate(template.id)}><Trash2 size={14} /></button>
                </article>
              ))}
            </div>
        ) : null}
        </details> : null}
        {step === "customer" ? <section className="v2-invoice-builder-section" aria-label="Invoice details">
          <header className="v2-invoice-section-title">
            <h3>Details</h3>
            <span>{toolContextLabel(workContext)}</span>
          </header>
          <div className="v2-tool-input-grid two v2-invoice-detail-grid">
            <label>Invoice #<input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></label>
            <label>Terms<input value={terms} onChange={(event) => setTerms(event.target.value)} /></label>
            <label>Bill to<input value={billTo} onChange={(event) => setBillTo(event.target.value)} placeholder="Contractor or company" /></label>
            <label>Pay to<input value={payTo} onChange={(event) => setPayTo(event.target.value)} placeholder="Your company or name" /></label>
            <label>Payment method<input value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} /></label>
            <label>Tax %<input type="number" min="0" value={taxPct} onChange={(event) => setTaxPct(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Recipient email<input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="name@company.com" /></label>
            <label>Recipient phone<input type="tel" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} placeholder="+1 904 555 0123" /></label>
          </div>
        </section> : null}
        {step === "items" ? <div className="v2-invoice-lines" aria-label="Invoice line items">
          <div className="v2-invoice-lines-header">
            <span>Line items</span>
            <button type="button" onClick={addLine}><Plus size={14} />Add item</button>
          </div>
          {lines.map((line) => {
            const signal = lineSignals.find((item) => item.lineId === line.id)?.signal;
            return (
              <div className="v2-invoice-line-group" key={line.id}>
                <div className="v2-invoice-line">
                  <input aria-label="Line description" value={line.description} placeholder="Description" onChange={(event) => updateLine(line.id, "description", event.target.value)} />
                  <input type="number" min="0" step="0.5" value={line.qty} aria-label={`${line.description || "Line"} quantity`} onChange={(event) => updateLine(line.id, "qty", Number(event.target.value) || 0)} />
                  <input type="number" min="0" value={line.rate} aria-label={`${line.description || "Line"} rate`} onChange={(event) => updateLine(line.id, "rate", Number(event.target.value) || 0)} />
                  <strong>{currency(centsToDollars(lineTotalCents(line)))}</strong>
                  <button type="button" aria-label={`Remove ${line.description || "line item"}`} onClick={() => removeLine(line.id)}><Trash2 size={14} /></button>
                </div>
                {signal ? (
                  <div className={`v2-line-price-signal is-${signal.tone}`}>
                    <span>{signal.verdict}</span>
                    <small>{signal.label}: {signal.rangeLabel}</small>
                  </div>
                ) : null}
            </div>
            );
          })}
        </div> : null}
      </Panel>

      {step === "review" ? <aside className="v2-invoice-side-stack">
        <Panel className="v2-tool-panel v2-tool-summary-panel v2-invoice-summary-panel" eyebrow="Total due" title={currency(total)}>
          {primarySignal ? (
            <section className={`v2-price-signal is-${primarySignal.tone}`} aria-label="Invoice pricing signal">
              <div>
                <span>Pricing signal</span>
                <strong>{primarySignal.verdict}</strong>
              </div>
              <p>{primarySignal.label}: {primarySignal.rangeLabel}</p>
              <small>{primarySignal.basisLabel}</small>
              <em>{primarySignal.note}</em>
            </section>
          ) : null}
          <div className="v2-tool-breakdown">
            <div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
            <div><span>Tax</span><strong>{currency(tax)}</strong></div>
            <div><span>Terms</span><strong>{terms}</strong></div>
            <div><span>Method</span><strong>{paymentMethod}</strong></div>
          </div>
          <p className="v2-tool-note">
            Email sends a finished invoice from RIVT and records delivery here. Text opens your device's message draft.
          </p>
          <div className="v2-invoice-delivery" aria-label="Invoice draft delivery">
            <button type="button" onClick={() => void emailInvoice()} disabled={invoiceEmailBusy || totalCents <= 0}>
              <Mail size={15} />
              {invoiceEmailBusy ? "Sending invoice..." : "Email invoice"}
            </button>
            <a href={recipientPhone ? smsHref : undefined} aria-disabled={!recipientPhone} onClick={(event) => {
              if (!recipientPhone) {
                event.preventDefault();
                setDraftSaveMessage("Add a recipient phone number before opening a text draft.");
                return;
              }
              setDraftSaveMessage("Text draft opened on this device.");
            }}>
              <MessageSquare size={15} />
              Text summary
            </a>
          </div>
        </Panel>

        <Panel className="v2-tool-panel v2-invoice-preview-panel" eyebrow="Customer document" title="Preview before delivery">
          <article className="v2-invoice-print-preview" aria-label="Printable invoice preview">
              <header>
                <div>
                  <strong>RIVT</strong>
                  <span>Invoice draft</span>
                </div>
                <aside>
                  <span>Invoice</span>
                  <strong>{invoiceNumber || "RIVT-DRAFT"}</strong>
                </aside>
              </header>
              <section className="v2-invoice-preview-meta">
                <div><span>Bill to</span><strong>{billTo || "Contractor / company"}</strong></div>
                <div><span>Pay to</span><strong>{payTo || "Your company / name"}</strong></div>
                <div><span>Work</span><strong>{toolContextLabel(workContext)}</strong></div>
                <div><span>Terms</span><strong>{terms}</strong></div>
              </section>
              <table>
                <thead>
                  <tr><th>Description</th><th>Qty</th><th>Rate</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.description || "Line item"}</td>
                      <td>{formatQuantity(line.qty)}</td>
                      <td>{currency(line.rate)}</td>
                      <td>{currency(centsToDollars(lineTotalCents(line)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <section className="v2-invoice-preview-totals">
                <div><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
                <div><span>Tax</span><strong>{currency(tax)}</strong></div>
                <div><span>Total due</span><strong>{currency(total)}</strong></div>
              </section>
              <footer>
                <span>{paymentMethod}</span>
                <p>RIVT generates this invoice for your records. Payments are collected directly between you and the client - not through RIVT.</p>
              </footer>
          </article>
          <div className="v2-invoice-preview-actions" aria-label="Invoice preview actions">
            <button type="button" className="v2-secondary-button" onClick={() => void copyInvoice()}><Copy size={16} />Copy invoice</button>
            <button type="button" className="v2-secondary-button" onClick={printInvoice}><FileText size={16} />Print or Save PDF</button>
          </div>
        </Panel>
      </aside> : null}
      <div className="v2-tool-action-dock" aria-label="Invoice actions">
        <span><strong>{currency(total)}</strong><small>{draftSaveMessage}</small></span>
        {step !== "items" ? <button type="button" onClick={() => setStep(step === "review" ? "customer" : "items")} aria-label="Previous invoice step"><ChevronLeft size={18} /></button> : null}
        <button type="button" className="v2-primary-button" onClick={() => void saveInvoiceDraft()} disabled={projectInvoiceBusy || totalCents <= 0 || invoiceEmailBusy}><Save size={18} />Save draft</button>
        {step === "items" ? <button type="button" className="v2-primary-button" onClick={() => setStep("customer")} disabled={totalCents <= 0}><span>Customer</span><ChevronRight size={18} /></button> : null}
        {step === "customer" ? <button type="button" className="v2-primary-button" onClick={() => setStep("review")}><span>Review</span><ChevronRight size={18} /></button> : null}
        {step === "review" ? <button type="button" onClick={copyInvoice} aria-label="Copy invoice"><Copy size={18} /></button> : null}
        {step === "review" ? <button type="button" onClick={printInvoice} aria-label="Print invoice"><FileText size={18} /></button> : null}
      </div>
    </div>
  );
}

