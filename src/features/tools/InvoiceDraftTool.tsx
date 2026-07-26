import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Check, ChevronLeft, ChevronRight, Copy, ExternalLink, FileText, LoaderCircle, Mail, MessageSquare, Plus, Save, Trash2 } from "lucide-react";
import type { Job } from "../../types";
import { Panel } from "../../components/ui";
import { CustomerPicker } from "../clients/CustomerPicker";
import {
  customerSnapshot as snapshotCustomer,
  type ClientRecord,
  type CustomerSnapshot,
} from "../clients/client-records";
import type { EstimateInvoiceDraft } from "./EstimateTool";
import { clampNumber, currency, formatQuantity, toCents, centsToDollars } from "./money";
import { getInvoiceLinePriceSignal } from "./priceGuidance";
import { deleteToolRecordByLocalId, fetchToolRecords, sendInvoiceByLocalId, upsertToolRecord, type ServerToolRecord, type ToolRecordInput } from "./tool-records-api";
import {
  cancelInvoiceBankPaymentLink,
  cancelToolInvoiceBankPaymentLink,
  createProjectInvoice,
  createInvoiceBankPaymentLink,
  createToolInvoiceBankPaymentLink,
  getProjectForActiveWork,
  getStripeConnectStatus,
  getToolInvoiceBankPayment,
  openStripeConnectDashboard,
  recordProjectInvoicePayment,
  startStripeConnectOnboarding,
  updateProjectInvoiceStatus,
  type ProjectInvoice,
  type ProjectInvoiceOnlinePayment,
  type StripeConnectStatus,
} from "./project-api";
import { toolContextLabel, toolContextRecordFields, toolContextStorageId, type ToolWorkContext } from "./tool-work-context";
import { DocumentBrandHeader, DocumentStylePicker } from "./DocumentBrandControls";
import {
  defaultDocumentBrand,
  fetchDocumentBrand,
  saveDocumentBrand,
  type DocumentBrand,
  type DocumentStyle,
} from "./document-brand-api";

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
const bankPaymentMethod = "Secure bank payment";

function normalizePaymentMethod(value: string | undefined) {
  const method = value?.trim() ?? "";
  return /^direct payment$/i.test(method) ? "" : method;
}

function paymentChoiceFromMethod(value: string | undefined): "bank" | "outside" {
  return /bank payment|ach/i.test(value ?? "") ? "bank" : "outside";
}

interface InvoiceDraftSnapshot {
  localId?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  customerNote: string;
  billTo: string;
  payTo: string;
  terms: string;
  paymentMethod: string;
  recipientEmail: string;
  recipientPhone: string;
  taxPct: number;
  templateName: string;
  lines: InvoiceLine[];
  customerId: string | null;
  customerSnapshot: CustomerSnapshot | null;
}

interface DocumentDelivery {
  status: "sent" | "failed";
  recipientEmail: string;
  attemptedAt: string;
  sentAt?: string;
  attemptCount: number;
  documentFingerprint?: string;
}

function deliveryFromRecord(record: ServerToolRecord | null | undefined): DocumentDelivery | null {
  const delivery = record?.payload?.delivery;
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) return null;
  const candidate = delivery as Partial<DocumentDelivery>;
  if (candidate.status !== "sent" && candidate.status !== "failed") return null;
  if (typeof candidate.recipientEmail !== "string" || typeof candidate.attemptedAt !== "string") return null;
  return {
    status: candidate.status,
    recipientEmail: candidate.recipientEmail,
    attemptedAt: candidate.attemptedAt,
    sentAt: typeof candidate.sentAt === "string" ? candidate.sentAt : undefined,
    attemptCount: typeof candidate.attemptCount === "number" ? candidate.attemptCount : 1,
    documentFingerprint: typeof candidate.documentFingerprint === "string" ? candidate.documentFingerprint : undefined,
  };
}

function today() {
  const value = new Date();
  const localValue = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return localValue.toISOString().slice(0, 10);
}

function newInvoiceNumber() {
  return `RIVT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function newInvoiceLocalId(context: ToolWorkContext) {
  return `invoice:${toolContextStorageId(context)}:${crypto.randomUUID()}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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

function invoiceDraftFromRecord(record: ServerToolRecord | null | undefined): Partial<InvoiceDraftSnapshot> {
  if (!record || record.recordType !== "invoice_draft") return {};
  const payload = record.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Partial<InvoiceDraftSnapshot>
    : {};
}

interface InvoicePrefs {
  payTo: string;
  terms: string;
  paymentMethod: string;
  taxPct: number;
}

function readInvoicePrefs(): InvoicePrefs {
  const fallback: InvoicePrefs = {
    payTo: "",
    terms: "Due on completion",
    paymentMethod: "",
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
  return [
    {
      id: crypto.randomUUID(),
      description: activeJob?.title?.trim() || "Work completed",
      qty: 1,
      rate: 0,
      kind: "other",
    },
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
  initialRecord = null,
}: {
  activeJob: Job | null;
  workContext: ToolWorkContext;
  estimateDraft?: EstimateInvoiceDraft | null;
  activeWorkId?: string | null;
  initialRecord?: ServerToolRecord | null;
}) {
  const [invoicePrefs] = useState(readInvoicePrefs);
  const [initialDraft] = useState(() => ({
    ...readInvoiceDraft(workContext),
    ...invoiceDraftFromRecord(initialRecord),
  }));
  const [recordLocalId, setRecordLocalId] = useState(initialRecord?.localId ?? initialDraft.localId ?? `invoice:${toolContextStorageId(workContext)}`);
  const [invoiceNumber, setInvoiceNumber] = useState(estimateDraft?.invoiceNumber ?? initialDraft.invoiceNumber ?? newInvoiceNumber());
  const [issueDate, setIssueDate] = useState(initialDraft.issueDate ?? today());
  const [dueDate, setDueDate] = useState(initialDraft.dueDate ?? "");
  const [customerNote, setCustomerNote] = useState(initialDraft.customerNote ?? "");
  const initialProjectInvoiceNumber = useRef(estimateDraft?.invoiceNumber ?? (activeJob ? `RIVT-${activeJob.id}` : "RIVT-DRAFT"));
  const [billTo, setBillTo] = useState(
    estimateDraft?.billTo
      || initialDraft.billTo
      || activeJob?.contractor
      || (workContext.kind === "standalone" ? workContext.project.clientName : ""),
  );
  const [payTo, setPayTo] = useState(initialDraft.payTo ?? invoicePrefs.payTo);
  const [terms, setTerms] = useState(estimateDraft?.terms ?? initialDraft.terms ?? invoicePrefs.terms);
  const initialPaymentMethod = normalizePaymentMethod(
    estimateDraft?.paymentMethod ?? initialDraft.paymentMethod ?? invoicePrefs.paymentMethod,
  );
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
  const [paymentChoice, setPaymentChoice] = useState<"bank" | "outside">(
    paymentChoiceFromMethod(initialPaymentMethod),
  );
  const [recipientEmail, setRecipientEmail] = useState(estimateDraft?.recipientEmail ?? initialDraft.recipientEmail ?? "");
  const [recipientPhone, setRecipientPhone] = useState(initialDraft.recipientPhone ?? "");
  const [customerId, setCustomerId] = useState<string | null>(
    estimateDraft?.customerId
      ?? initialDraft.customerId
      ?? initialRecord?.customerId
      ?? (workContext.kind === "standalone" ? workContext.project.customerId : null),
  );
  const [selectedCustomerSnapshot, setSelectedCustomerSnapshot] = useState<CustomerSnapshot | null>(estimateDraft?.customerSnapshot ?? initialDraft.customerSnapshot ?? null);
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
  const [draftSaveMessage, setDraftSaveMessage] = useState(initialRecord ? "Loaded from your RIVT account." : "Autosaved on this device.");
  const [draftSaveState, setDraftSaveState] = useState<"idle" | "saving" | "saved" | "error">(initialRecord ? "saved" : "idle");
  const [removedLine, setRemovedLine] = useState<{ line: InvoiceLine; index: number } | null>(null);
  const [projectInvoice, setProjectInvoice] = useState<ProjectInvoice | null>(null);
  const [projectInvoiceBusy, setProjectInvoiceBusy] = useState(false);
  const [projectInvoiceNotice, setProjectInvoiceNotice] = useState("");
  const [projectInvoiceError, setProjectInvoiceError] = useState("");
  const [connectStatus, setConnectStatus] = useState<StripeConnectStatus | null>(null);
  const [toolPaymentRequest, setToolPaymentRequest] = useState<ProjectInvoiceOnlinePayment | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [invoiceEmailBusy, setInvoiceEmailBusy] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethodDraft, setPaymentMethodDraft] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [delivery, setDelivery] = useState<DocumentDelivery | null>(deliveryFromRecord(initialRecord));
  const [lastSentFingerprint, setLastSentFingerprint] = useState(() => {
    const value = deliveryFromRecord(initialRecord)?.documentFingerprint
      ?? (initialRecord?.status === "sent" ? initialRecord?.payload?.documentFingerprint : "");
    return typeof value === "string" ? value : "";
  });
  const [validationMessage, setValidationMessage] = useState("");
  const [step, setStep] = useState<"items" | "customer" | "review">("items");
  const [documentBrand, setDocumentBrand] = useState<DocumentBrand>(() => defaultDocumentBrand());
  const [brandMessage, setBrandMessage] = useState("Document style syncs to your RIVT account.");
  const localDraftStorageKey = invoiceDraftStorageKey(workContext);

  useEffect(() => {
    let cancelled = false;
    void fetchDocumentBrand()
      .then((brand) => {
        if (cancelled) return;
        setDocumentBrand(brand);
        setPayTo((current) => current.trim() ? current : brand.businessName);
      })
      .catch(() => {
        if (!cancelled) setBrandMessage("Using the standard document style until account branding can load.");
      });
    return () => { cancelled = true; };
  }, []);

  const subtotalCents = lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
  const taxCents = Math.round(subtotalCents * (numericValue(taxPct) / 100));
  const totalCents = subtotalCents + taxCents;
  const subtotal = centsToDollars(subtotalCents);
  const tax = centsToDollars(taxCents);
  const total = centsToDollars(totalCents);
  const projectPaymentRequest = projectInvoice?.onlinePayments
    ?.filter((payment) => ["created", "open", "processing"].includes(payment.status))
    .at(-1) ?? null;
  const activeBankPayment = projectPaymentRequest
    ?? (toolPaymentRequest && ["created", "open", "processing"].includes(toolPaymentRequest.status)
      ? toolPaymentRequest
      : null);
  const bankPaymentUrl = activeBankPayment?.paymentUrl ?? activeBankPayment?.checkoutUrl ?? null;
  const customerPaymentMethod = paymentChoice === "bank"
    ? bankPaymentMethod
    : paymentMethod.trim();
  const documentCustomerSnapshot = customerId && selectedCustomerSnapshot
    ? {
        ...selectedCustomerSnapshot,
        customerId,
        displayName: billTo.trim() || selectedCustomerSnapshot.displayName,
        email: recipientEmail.trim().toLowerCase(),
        phone: recipientPhone.trim(),
      }
    : null;
  const documentFingerprint = JSON.stringify({
    invoiceNumber: invoiceNumber.trim(),
    issueDate,
    dueDate,
    billTo: billTo.trim(),
    payTo: payTo.trim(),
    terms: terms.trim(),
    paymentMethod: customerPaymentMethod,
    recipientEmail: recipientEmail.trim().toLowerCase(),
    recipientPhone: recipientPhone.trim(),
    customerId,
    customerSnapshot: documentCustomerSnapshot,
    taxPct,
    customerNote: customerNote.trim(),
    lines: lines.map((line) => ({
      description: line.description.trim(),
      qty: numericValue(line.qty),
      rateCents: toCents(numericValue(line.rate)),
      kind: line.kind ?? "other",
    })),
    documentBrand: {
      businessName: documentBrand.businessName,
      invoiceStyle: documentBrand.invoiceStyle,
      logoUploadId: documentBrand.logoUploadId,
      updatedAt: documentBrand.updatedAt,
    },
  });
  const hasUnsentChanges = delivery?.status === "sent"
    && Boolean(lastSentFingerprint)
    && lastSentFingerprint !== documentFingerprint;
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
    `${documentBrand.businessName || "RIVT member"} invoice ${invoiceNumber}`,
    `Invoice date: ${issueDate}`,
    dueDate ? `Due date: ${dueDate}` : "",
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
    `Payment method: ${customerPaymentMethod || "Not entered"}`,
    customerNote.trim() ? `Note: ${customerNote.trim()}` : "",
    bankPaymentUrl ? `Pay securely from a US bank account: ${bankPaymentUrl}` : "",
    paymentChoice === "bank"
      ? "Bank payment is handled by Stripe for the sender. RIVT does not hold job funds."
      : "Payment is arranged directly with the sender using the instructions above.",
  ].filter(Boolean).join("\n"), [bankPaymentUrl, billTo, customerNote, customerPaymentMethod, documentBrand.businessName, dueDate, invoiceNumber, issueDate, lines, payTo, paymentChoice, subtotal, tax, terms, total, workContext]);
  const smsHref = `sms:${encodeURIComponent(recipientPhone)}?body=${encodeURIComponent(
    `RIVT invoice ${invoiceNumber}: ${currency(total)} due. ${terms}. ${customerPaymentMethod || "Contact the sender for payment instructions"}.${bankPaymentUrl ? ` Pay: ${bankPaymentUrl}` : ""}`,
  )}`;

  useEffect(() => {
    let cancelled = false;
    if (activeWorkId) {
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
    }
    void getStripeConnectStatus()
      .then((status) => {
        if (!cancelled) setConnectStatus(status);
      })
      .catch(() => {
        if (!cancelled) setConnectStatus(null);
      });
    void getToolInvoiceBankPayment(recordLocalId)
      .then((payment) => {
        if (!cancelled) {
          setToolPaymentRequest(payment);
          if (payment && ["created", "open", "processing"].includes(payment.status)) {
            setPaymentChoice("bank");
            setPaymentMethod(bankPaymentMethod);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setToolPaymentRequest(null);
      });
    return () => { cancelled = true; };
  }, [activeWorkId, recordLocalId]);

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("invoice_draft").then((records) => {
      if (cancelled) return;
      const record = records?.find((candidate) => candidate.localId === recordLocalId) ?? null;
      const recordDelivery = deliveryFromRecord(record);
      setDelivery(recordDelivery);
      const fingerprint = recordDelivery?.documentFingerprint
        ?? (record?.status === "sent" && typeof record?.payload?.documentFingerprint === "string"
          ? record.payload.documentFingerprint
          : "");
      setLastSentFingerprint(fingerprint);
    });
    return () => { cancelled = true; };
  }, [recordLocalId]);

  useEffect(() => {
    try {
      localStorage.setItem(invoicePrefsStorageKey, JSON.stringify({
        payTo,
        terms,
        paymentMethod,
        taxPct,
      }));
    } catch {
      // Invoice defaults are a convenience only; templates and manual entry still work.
    }
  }, [paymentMethod, payTo, taxPct, terms]);

  useEffect(() => {
    const snapshot: InvoiceDraftSnapshot = {
      localId: recordLocalId,
      invoiceNumber,
      issueDate,
      dueDate,
      customerNote,
      billTo,
      payTo,
      terms,
      paymentMethod,
      recipientEmail,
      recipientPhone,
      taxPct,
      templateName,
      lines,
      customerId,
      customerSnapshot: selectedCustomerSnapshot,
    };
    try {
      localStorage.setItem(localDraftStorageKey, JSON.stringify(snapshot));
    } catch {
      queueMicrotask(() => {
        setDraftSaveState("error");
        setDraftSaveMessage("This draft could not be saved on this device. Keep this page open and copy your work.");
      });
    }
  }, [billTo, customerId, customerNote, dueDate, invoiceNumber, issueDate, lines, localDraftStorageKey, paymentMethod, payTo, recipientEmail, recipientPhone, recordLocalId, selectedCustomerSnapshot, taxPct, templateName, terms]);

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

  async function changeInvoiceStyle(style: DocumentStyle) {
    const previous = documentBrand;
    const next = { ...documentBrand, invoiceStyle: style };
    setDocumentBrand(next);
    setBrandMessage("Saving document style...");
    try {
      const saved = await saveDocumentBrand(next);
      setDocumentBrand(saved);
      setBrandMessage(`${style === "classic" ? "Classic" : style === "compact" ? "Compact" : "Field"} style saved for future invoices.`);
    } catch {
      setDocumentBrand(previous);
      setBrandMessage("Document style could not be saved. Your previous style is still active.");
    }
  }

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
    markDraftChanged();
    setRemovedLine(null);
    setLines((current) => [...current, { id: crypto.randomUUID(), description: "", qty: 1, rate: 0, kind: "other" }]);
  }

  function removeLine(id: string) {
    if (lines.length <= 1) return;
    const index = lines.findIndex((line) => line.id === id);
    if (index < 0) return;
    markDraftChanged();
    setRemovedLine({ line: lines[index], index });
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function undoRemoveLine() {
    if (!removedLine) return;
    markDraftChanged();
    setLines((current) => {
      const next = [...current];
      next.splice(Math.min(removedLine.index, next.length), 0, removedLine.line);
      return next;
    });
    setRemovedLine(null);
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
      invoiceNumber: "",
      billTo: "",
      payTo: "",
      terms,
      paymentMethod,
      recipientEmail: "",
      recipientPhone: "",
      taxPct,
      lines: lines.map((line) => ({ ...line, id: crypto.randomUUID() })),
    };
    persistTemplates([template, ...templates.filter((item) => item.name.toLowerCase() !== cleanName.toLowerCase())], "Template saved.", template);
  }

  function loadTemplate(template: InvoiceTemplate) {
    markDraftChanged();
    setTemplateName(template.name);
    if (template.payTo.trim()) setPayTo(template.payTo);
    if (template.terms.trim()) setTerms(template.terms);
    const nextPaymentMethod = normalizePaymentMethod(template.paymentMethod);
    setPaymentMethod(nextPaymentMethod);
    setPaymentChoice(paymentChoiceFromMethod(nextPaymentMethod));
    setTaxPct(template.taxPct);
    setLines(template.lines.length ? template.lines.map((line) => ({ ...line, id: crypto.randomUUID() })) : [{ id: crypto.randomUUID(), description: "", qty: 1, rate: 0, kind: "other" }]);
    setTemplateNotice(`Loaded ${template.name}. Customer and invoice identity were kept separate.`);
  }

  function deleteTemplate(templateId: string) {
    persistTemplates(templates.filter((template) => template.id !== templateId), "Template removed from this device.");
    void deleteToolRecordByLocalId("invoice_template", templateId).then((ok) => {
      setSyncMessage(ok ? "Deleted from this device and your RIVT account." : "Deleted on this device only. Could not sync deletion.");
    });
  }

  function startBlankInvoice() {
    const latestPrefs = readInvoicePrefs();
    setRecordLocalId(newInvoiceLocalId(workContext));
    setInvoiceNumber(newInvoiceNumber());
    setIssueDate(today());
    setDueDate("");
    setCustomerNote("");
    setBillTo("");
    setPayTo(latestPrefs.payTo);
    setTerms(latestPrefs.terms);
    const nextPaymentMethod = normalizePaymentMethod(latestPrefs.paymentMethod);
    setPaymentMethod(nextPaymentMethod);
    setPaymentChoice(paymentChoiceFromMethod(nextPaymentMethod));
    setRecipientEmail("");
    setRecipientPhone("");
    setCustomerId(null);
    setSelectedCustomerSnapshot(null);
    setTaxPct(latestPrefs.taxPct);
    setTemplateName("Standard invoice");
    setLines(defaultInvoiceLines(activeJob));
    setConversionNotice("");
    setTemplateNotice("Blank invoice started.");
    setProjectInvoice(null);
    setToolPaymentRequest(null);
    setProjectInvoiceNotice("");
    setProjectInvoiceError("");
    setDelivery(null);
    setLastSentFingerprint("");
    setValidationMessage("");
    setDraftSaveState("idle");
    setDraftSaveMessage("New invoice started. Enter the real amount to bill.");
    setStep("items");
  }

  function projectInvoiceInput(methodOverride = customerPaymentMethod) {
    return {
      invoiceNumber: invoiceNumber.trim() || "RIVT-DRAFT",
      billTo: billTo.trim(),
      payTo: payTo.trim(),
      terms: terms.trim(),
      paymentMethod: methodOverride.trim(),
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

  function invoiceToolRecordInput(methodOverride = customerPaymentMethod): ToolRecordInput {
    const snapshot: InvoiceDraftSnapshot = {
      localId: recordLocalId,
      invoiceNumber,
      issueDate,
      dueDate,
      customerNote,
      billTo,
      payTo,
      terms,
      paymentMethod: methodOverride,
      recipientEmail,
      recipientPhone,
      taxPct,
      templateName,
      lines,
      customerId,
      customerSnapshot: documentCustomerSnapshot,
    };
    return {
      recordType: "invoice_draft",
      localId: recordLocalId,
      title: `${invoiceNumber || "RIVT-DRAFT"} - ${toolContextLabel(workContext)}`,
      status: delivery?.status === "sent" && !hasUnsentChanges ? "sent" : "draft",
      recordDate: issueDate,
      amountCents: totalCents,
      customerId,
      payload: {
        ...snapshot,
        documentFingerprint,
        delivery: delivery ?? undefined,
        projectInvoiceId: projectInvoice?.id ?? null,
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

  async function saveInvoiceDraft(methodOverride = customerPaymentMethod): Promise<ServerToolRecord | null> {
    setDraftSaveState("saving");
    setDraftSaveMessage("Saving draft...");
    const record = await upsertToolRecord(invoiceToolRecordInput(methodOverride));
    if (!record) {
      setDraftSaveMessage("Draft kept on this device. RIVT account sync failed.");
      setDraftSaveState("error");
      return null;
    }
    if (activeWorkId && !projectInvoice) {
      const savedToWork = await saveToActiveWork(methodOverride);
      setDraftSaveMessage(savedToWork ? "Draft saved to this job and your RIVT account." : "Draft saved to your RIVT account. It could not be added to the job workspace.");
      setDraftSaveState(savedToWork ? "saved" : "error");
      return record;
    }
    setDraftSaveMessage(activeWorkId ? "Draft saved to this job and your RIVT account." : "Draft saved to your RIVT account.");
    setDraftSaveState("saved");
    return record;
  }

  async function saveToActiveWork(methodOverride = customerPaymentMethod) {
    if (!activeWorkId) return false;
    setProjectInvoiceBusy(true);
    setProjectInvoiceError("");
    setProjectInvoiceNotice("");
    try {
      const saved = await createProjectInvoice(activeWorkId, projectInvoiceInput(methodOverride));
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
    if (!paymentMethodDraft.trim()) {
      setProjectInvoiceError("Enter how the external payment was received.");
      return;
    }
    setProjectInvoiceBusy(true);
    setProjectInvoiceError("");
    setProjectInvoiceNotice("");
    try {
      const updated = await recordProjectInvoicePayment(projectInvoice.id, {
        amountCents,
        paymentDate: new Date().toISOString().slice(0, 10),
        method: paymentMethodDraft.trim(),
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

  async function openBankPaymentSetup() {
    setConnectBusy(true);
    setProjectInvoiceError("");
    setProjectInvoiceNotice("");
    try {
      const onboarding = await startStripeConnectOnboarding(activeWorkId);
      window.location.assign(onboarding.url);
    } catch (error) {
      setProjectInvoiceError(error instanceof Error ? error.message : "RIVT could not open Stripe bank-payment setup.");
      setConnectBusy(false);
    }
  }

  async function manageBankPaymentAccount() {
    setConnectBusy(true);
    setProjectInvoiceError("");
    try {
      const dashboard = await openStripeConnectDashboard();
      window.location.assign(dashboard.url);
    } catch (error) {
      setProjectInvoiceError(error instanceof Error ? error.message : "RIVT could not open the Stripe account.");
      setConnectBusy(false);
    }
  }

  async function createBankPaymentLink() {
    setConnectBusy(true);
    setProjectInvoiceError("");
    setProjectInvoiceNotice("");
    try {
      setPaymentChoice("bank");
      setPaymentMethod(bankPaymentMethod);
      let savedProjectInvoice = projectInvoice;
      if (activeWorkId && !savedProjectInvoice) {
        const saved = await createProjectInvoice(activeWorkId, projectInvoiceInput(bankPaymentMethod));
        setProjectInvoice(saved);
        setPaymentAmount((saved.balanceCents / 100).toFixed(2));
        savedProjectInvoice = saved;
      }
      let paymentRequest: ProjectInvoiceOnlinePayment;
      if (savedProjectInvoice) {
        paymentRequest = await createInvoiceBankPaymentLink(savedProjectInvoice.id);
        setProjectInvoice((current) => current ? {
          ...current,
          onlinePayments: [
            ...(current.onlinePayments ?? []).filter((payment) => payment.id !== paymentRequest.id),
            paymentRequest,
          ],
        } : current);
      } else {
        const record = await upsertToolRecord(invoiceToolRecordInput(bankPaymentMethod));
        if (!record) {
          throw new Error("Save this invoice to your RIVT account before creating its payment link.");
        }
        paymentRequest = await createToolInvoiceBankPaymentLink(record.localId);
        setToolPaymentRequest(paymentRequest);
      }
      const shareUrl = paymentRequest.paymentUrl ?? paymentRequest.checkoutUrl;
      if (shareUrl) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setProjectInvoiceNotice("Secure customer payment link created and copied.");
        } catch {
          setProjectInvoiceNotice("Secure customer payment link created. It will be included when you email the invoice.");
        }
      } else {
        setProjectInvoiceNotice("Bank payment is already processing. RIVT will update the invoice after Stripe confirms it.");
      }
      return paymentRequest;
    } catch (error) {
      setProjectInvoiceError(error instanceof Error ? error.message : "RIVT could not create the bank-payment link.");
      return null;
    } finally {
      setConnectBusy(false);
    }
  }

  async function copyBankPaymentLink(payment: ProjectInvoiceOnlinePayment) {
    const shareUrl = payment.paymentUrl ?? payment.checkoutUrl;
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setProjectInvoiceNotice("Secure customer payment link copied.");
    } catch {
      setProjectInvoiceError("Copy failed. Open the payment page and copy its address.");
    }
  }

  async function cancelBankPaymentLink() {
    setConnectBusy(true);
    setProjectInvoiceError("");
    setProjectInvoiceNotice("");
    try {
      if (projectInvoice) {
        const paymentRequest = await cancelInvoiceBankPaymentLink(projectInvoice.id);
        setProjectInvoice((current) => current ? {
          ...current,
          onlinePayments: (current.onlinePayments ?? []).map((payment) => (
            payment.id === paymentRequest.id ? paymentRequest : payment
          )),
        } : current);
      } else {
        const paymentRequest = await cancelToolInvoiceBankPaymentLink(recordLocalId);
        setToolPaymentRequest(paymentRequest);
      }
      setProjectInvoiceNotice("Bank-payment link cancelled. No payment was submitted through that link.");
    } catch (error) {
      setProjectInvoiceError(error instanceof Error ? error.message : "RIVT could not cancel the bank-payment link.");
    } finally {
      setConnectBusy(false);
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
    setDraftSaveMessage("Print dialog opened. Choose Save as PDF to download a copy.");
    window.print();
  }

  function markDraftChanged() {
    setDraftSaveState("idle");
    setDraftSaveMessage("Saved on this device. Save to sync these changes to your RIVT account.");
  }

  function chooseCustomer(customer: ClientRecord | null) {
    markDraftChanged();
    if (!customer) {
      setCustomerId(null);
      setSelectedCustomerSnapshot(null);
      return;
    }
    const snapshot = snapshotCustomer(customer);
    setCustomerId(customer.id);
    setSelectedCustomerSnapshot(snapshot);
    setBillTo(snapshot.displayName);
    setRecipientEmail(snapshot.email);
    setRecipientPhone(snapshot.phone);
    if (customer.defaultTerms.trim()) setTerms(customer.defaultTerms);
  }

  function validateCustomerStep(requireEmail = false) {
    if (!invoiceNumber.trim()) return "Add an invoice number.";
    if (!issueDate) return "Choose the invoice date.";
    if (dueDate && dueDate < issueDate) return "Due date cannot be before the invoice date.";
    if (!billTo.trim()) return "Add the customer or company being billed.";
    if (!payTo.trim()) return "Add the person or company receiving payment.";
    if (!terms.trim()) return "Add payment terms.";
    if (requireEmail && !isValidEmail(recipientEmail)) return "Add a valid recipient email.";
    if (recipientEmail.trim() && !isValidEmail(recipientEmail)) return "Check the recipient email or leave it blank for print-only review.";
    return "";
  }

  function openInvoiceReview() {
    const message = validateCustomerStep();
    setValidationMessage(message);
    if (message) return;
    setStep("review");
  }

  async function emailInvoice() {
    const customerError = validateCustomerStep(true);
    if (customerError) {
      setStep("customer");
      setValidationMessage(customerError);
      setDraftSaveMessage(customerError);
      setDraftSaveState("error");
      return;
    }
    if (!totalCents) {
      setStep("items");
      setDraftSaveMessage("Add at least one priced line before sending.");
      return;
    }
    if (paymentChoice === "outside" && !paymentMethod.trim()) {
      setStep("review");
      setProjectInvoiceError("Add clear payment instructions so the customer knows how and where to pay.");
      setDraftSaveMessage("Payment instructions are still required.");
      setDraftSaveState("error");
      return;
    }
    if (paymentChoice === "bank" && !connectStatus?.ready) {
      setProjectInvoiceError("Finish Stripe bank-payment setup before emailing this invoice with a pay button.");
      return;
    }
    setInvoiceEmailBusy(true);
    let preparedBankPayment = activeBankPayment;
    if (paymentChoice === "bank" && !bankPaymentUrl) {
      preparedBankPayment = await createBankPaymentLink();
      if (!preparedBankPayment?.paymentUrl && !preparedBankPayment?.checkoutUrl) {
        setInvoiceEmailBusy(false);
        return;
      }
    }
    if (paymentChoice === "bank" && preparedBankPayment?.status === "processing") {
      setProjectInvoiceError("This bank payment is already processing. Do not send a second payment request.");
      setInvoiceEmailBusy(false);
      return;
    }
    const record = await saveInvoiceDraft(
      paymentChoice === "bank" ? bankPaymentMethod : paymentMethod.trim(),
    );
    if (!record) {
      setInvoiceEmailBusy(false);
      return;
    }
    try {
      const sent = await sendInvoiceByLocalId(record.localId);
      const sentDelivery = deliveryFromRecord(sent);
      const recipient = sentDelivery?.recipientEmail ?? recipientEmail.trim();
      setDelivery(sentDelivery);
      setLastSentFingerprint(documentFingerprint);
      setDraftSaveMessage(`Invoice emailed to ${recipient}.`);
      setDraftSaveState("saved");
    } catch (error) {
      setDraftSaveMessage(error instanceof Error ? error.message : "RIVT could not send the invoice.");
      setDraftSaveState("error");
    } finally {
      setInvoiceEmailBusy(false);
    }
  }

  return (
    <div className={`v2-tool-workbench v2-invoice-workbench is-${step}`} onChangeCapture={markDraftChanged}>
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

        {step === "review" ? (
          <section className="v2-invoice-payment-path" aria-labelledby="invoice-payment-path-title">
            <header>
              <div>
                <span>Customer action</span>
                <h3 id="invoice-payment-path-title">How should the customer pay?</h3>
              </div>
              {bankPaymentUrl ? <strong><Check size={16} />Pay link ready</strong> : null}
            </header>
            <div className="v2-invoice-payment-options" role="radiogroup" aria-label="Invoice payment method">
              <button
                type="button"
                role="radio"
                aria-checked={paymentChoice === "bank"}
                className={paymentChoice === "bank" ? "is-selected" : ""}
                onClick={() => {
                  setPaymentChoice("bank");
                  setPaymentMethod(bankPaymentMethod);
                  setProjectInvoiceError("");
                }}
              >
                <Banknote size={20} aria-hidden="true" />
                <span>
                  <strong>Pay securely by bank</strong>
                  <small>A pay button is included in the email and invoice.</small>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={paymentChoice === "outside"}
                className={paymentChoice === "outside" ? "is-selected" : ""}
                onClick={() => {
                  setPaymentChoice("outside");
                  if (paymentChoice === "bank" || paymentMethod === bankPaymentMethod) setPaymentMethod("");
                  setProjectInvoiceError("");
                }}
              >
                <MessageSquare size={20} aria-hidden="true" />
                <span>
                  <strong>Pay another way</strong>
                  <small>You provide the exact cash, check, card, or transfer instructions.</small>
                </span>
              </button>
            </div>
            {paymentChoice === "bank" ? (
              <div className="v2-invoice-bank-payment is-primary">
                <div>
                  <Banknote size={18} aria-hidden="true" />
                  <span>
                    <strong>{bankPaymentUrl
                      ? "Customer payment page is ready"
                      : connectStatus?.ready
                        ? "Create the secure payment page"
                        : connectStatus?.connected
                          ? "Finish Stripe setup"
                          : "Set up bank payments"}</strong>
                    <small>{bankPaymentUrl
                      ? "Email will include a clear Pay securely by bank button."
                      : connectStatus?.ready
                        ? "RIVT will create a short customer link and include it when you email."
                        : "Stripe must verify your payout account before RIVT can add a pay button."}</small>
                    <small>Stripe fees and ACH timing apply. RIVT does not hold job funds.</small>
                  </span>
                </div>
                {!connectStatus?.ready ? (
                  <button type="button" className="v2-primary-button" onClick={() => void openBankPaymentSetup()} disabled={connectBusy || !connectStatus?.providerConfigured}>
                    {connectBusy ? "Opening Stripe..." : connectStatus?.connected ? "Continue Stripe setup" : "Set up bank payments"}
                  </button>
                ) : !bankPaymentUrl ? (
                  <button type="button" className="v2-primary-button" onClick={() => void createBankPaymentLink()} disabled={connectBusy || totalCents <= 0}>
                    {connectBusy ? "Creating pay link..." : "Create secure pay link"}
                  </button>
                ) : (
                  <div className="v2-tool-action-row">
                    <button type="button" className="v2-primary-button" onClick={() => void copyBankPaymentLink(activeBankPayment!)}><Copy size={15} />Copy pay link</button>
                    <a href={bankPaymentUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Open customer page</a>
                    {activeBankPayment?.status !== "processing" ? (
                      <button type="button" onClick={() => void cancelBankPaymentLink()} disabled={connectBusy}>Cancel link</button>
                    ) : null}
                  </div>
                )}
                {connectStatus?.ready ? (
                  <button type="button" className="v2-invoice-manage-stripe" onClick={() => void manageBankPaymentAccount()} disabled={connectBusy}>
                    Manage payout account
                  </button>
                ) : null}
              </div>
            ) : (
              <label className="v2-invoice-payment-instructions">
                Payment instructions
                <textarea
                  value={paymentMethod}
                  onChange={(event) => {
                    setPaymentMethod(event.target.value);
                    setProjectInvoiceError("");
                    if (draftSaveState === "error") {
                      setDraftSaveState("idle");
                      setDraftSaveMessage("Payment instructions updated. Review before sending.");
                    }
                  }}
                  placeholder="Example: Pay by check to Punchlist People, 6563 Ector Place, Jacksonville, FL 32211."
                  rows={3}
                />
                <small>This exact instruction appears on the invoice and in the email. Do not include private account credentials.</small>
              </label>
            )}
            {projectInvoiceNotice ? <p className="v2-record-notice" role="status">{projectInvoiceNotice}</p> : null}
            {projectInvoiceError ? <p className="v2-record-error" role="alert">{projectInvoiceError}</p> : null}
          </section>
        ) : null}

        {step === "review" && activeWorkId ? (
          <section className="v2-invoice-project-record" aria-label="Job invoice record">
            <div>
              <span>Job invoice record</span>
              <strong>{projectInvoice ? `${projectInvoice.status} - ${currency(projectInvoice.balanceCents / 100)} remaining` : "Not saved to this job yet"}</strong>
              <small>External payments are recorded by you. Stripe bank payments remain processing until Stripe confirms settlement.</small>
            </div>
            <div className="v2-tool-action-row">
              <button type="button" className="v2-primary-button" onClick={() => void saveToActiveWork()} disabled={projectInvoiceBusy || totalCents <= 0 || Boolean(projectInvoice)}>
                {projectInvoiceBusy ? "Saving..." : projectInvoice ? "Saved to job" : "Save to job"}
              </button>
              {projectInvoice ? <button type="button" onClick={startBlankInvoice} disabled={projectInvoiceBusy}>New invoice</button> : null}
              {projectInvoice && projectInvoice.status === "draft" ? <button type="button" onClick={() => void markProjectInvoiceSent()} disabled={projectInvoiceBusy}>Mark sent</button> : null}
            </div>
            {/* Bank-payment setup and link actions now live in the primary payment path above.
            {projectInvoice ? (
              <>
                {connectStatus?.providerConfigured
                  || connectStatus?.connected
                  || (projectInvoice.onlinePayments ?? []).length > 0 ? (
                  <div className="v2-invoice-bank-payment">
                  <div>
                    <Banknote size={18} aria-hidden="true" />
                    <span>
                      <strong>Customer bank payment</strong>
                      <small>
                        {!connectStatus?.providerConfigured
                          ? "New bank-payment links are paused. Existing Stripe payment status remains visible."
                          : connectStatus.ready
                            ? "ACH is ready. Funds go to your connected Stripe account."
                            : connectStatus.connected
                              ? "Continue Stripe setup before accepting bank payments."
                            : "Connect Stripe to accept ACH payments directly from customers."}
                      </small>
                      {connectStatus?.providerConfigured ? <small>Stripe fees and ACH timing apply. Review payout details in Stripe.</small> : null}
                    </span>
                  </div>
                  {connectStatus?.providerConfigured && !connectStatus.ready ? (
                    <button type="button" onClick={() => void openBankPaymentSetup()} disabled={connectBusy || projectInvoice.status === "void"}>
                      {connectBusy ? "Opening Stripe..." : connectStatus.connected ? "Continue setup" : "Set up bank payments"}
                    </button>
                  ) : null}
                  {connectStatus?.ready && projectInvoice.balanceCents > 0 && projectInvoice.status !== "void" ? (
                    <button type="button" className="v2-primary-button" onClick={() => void createBankPaymentLink()} disabled={connectBusy}>
                      {connectBusy ? "Creating..." : "Copy bank-payment link"}
                    </button>
                  ) : null}
                  {connectStatus?.ready ? (
                    <button type="button" onClick={() => void manageBankPaymentAccount()} disabled={connectBusy}>Manage Stripe account</button>
                  ) : null}
                  {(projectInvoice.onlinePayments ?? []).map((payment) => (
                    <div className={`v2-invoice-online-payment is-${payment.status}`} key={payment.id}>
                      <span>
                        <strong>{payment.status === "open" || payment.status === "created"
                          ? "Link ready"
                          : payment.status === "processing"
                            ? "Bank payment processing"
                            : payment.status === "paid"
                              ? "Bank payment settled"
                              : payment.status === "partially_refunded"
                                ? "Bank payment partially refunded"
                                : payment.status === "refunded"
                                  ? "Bank payment refunded"
                                  : payment.status === "disputed"
                                    ? "Bank payment disputed"
                                    : payment.status === "expired"
                                      ? "Payment link expired"
                                      : "Bank payment failed"}</strong>
                        <small>{currency((payment.amountCents - payment.refundedCents) / 100)}
                          {payment.status === "processing" ? " · not marked paid yet" : ""}
                        </small>
                      </span>
                      {payment.checkoutUrl && ["created", "open"].includes(payment.status) ? (
                        <span className="v2-tool-action-row">
                          <button type="button" aria-label="Copy customer bank-payment link" onClick={() => void copyBankPaymentLink(payment)}><Copy size={15} /></button>
                          <a href={payment.checkoutUrl} target="_blank" rel="noreferrer" aria-label="Open customer bank-payment page"><ExternalLink size={15} /></a>
                          <button type="button" onClick={() => void cancelBankPaymentLink()} disabled={connectBusy}>Cancel link</button>
                        </span>
                      ) : null}
                    </div>
                  ))}
                  </div>
                ) : null}
                <details className="v2-invoice-external-payment">
                  <summary>Record payment received outside RIVT</summary>
                  <div className="v2-invoice-payment-record">
                    <label>Amount received<input inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} aria-label="External payment amount" /></label>
                    <label>Method<input value={paymentMethodDraft} onChange={(event) => setPaymentMethodDraft(event.target.value)} placeholder="Check, cash, bank transfer…" /></label>
                    <label>Note<input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Optional reference" /></label>
                    <button type="button" onClick={() => void recordExternalPayment()} disabled={projectInvoiceBusy || projectInvoice.status === "void" || projectInvoice.balanceCents <= 0}>Record external payment</button>
                  </div>
                </details>
              </>
            ) : null} */}
            {projectInvoice ? (
              <details className="v2-invoice-external-payment">
                <summary>Record payment received outside RIVT</summary>
                <div className="v2-invoice-payment-record">
                  <label>Amount received<input inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} aria-label="External payment amount" /></label>
                  <label>Method<input value={paymentMethodDraft} onChange={(event) => setPaymentMethodDraft(event.target.value)} placeholder="Check, cash, bank transfer…" /></label>
                  <label>Note<input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Optional reference" /></label>
                  <button type="button" onClick={() => void recordExternalPayment()} disabled={projectInvoiceBusy || projectInvoice.status === "void" || projectInvoice.balanceCents <= 0}>Record external payment</button>
                </div>
              </details>
            ) : null}
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
        <small className="v2-invoice-template-boundary">
          Templates save line items, terms, tax, and payment setup—not customer identity or invoice numbers.
        </small>
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
          <CustomerPicker selectedCustomerId={customerId} onSelect={chooseCustomer} />
          <div className="v2-tool-input-grid two v2-invoice-detail-grid">
            <label>Invoice #<input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} /></label>
            <label>Invoice date<input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></label>
            <label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <label>Terms<input value={terms} onChange={(event) => setTerms(event.target.value)} /></label>
            <label>Bill to<input value={billTo} onChange={(event) => setBillTo(event.target.value)} placeholder="Contractor or company" /></label>
            <label>Pay to<input value={payTo} onChange={(event) => setPayTo(event.target.value)} placeholder="Your company or name" /></label>
            <label>Tax %<input type="number" min="0" value={taxPct} onChange={(event) => setTaxPct(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Recipient email<input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="name@company.com" /></label>
            <label>Recipient phone<input type="tel" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} placeholder="+1 904 555 0123" /></label>
            <label className="is-wide">Customer note<textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Optional note, reference, or thank-you." rows={3} /></label>
          </div>
          <DocumentStylePicker
            label="Invoice appearance"
            value={documentBrand.invoiceStyle}
            onChange={(style) => void changeInvoiceStyle(style)}
            footer={<small className="v2-document-style-status">{brandMessage} Logo and business details are managed in Profile → Business.</small>}
          />
          <p className="v2-tool-note">Choose bank payment or enter other payment instructions on the final review.</p>
          {validationMessage ? <p className="v2-record-error" role="alert">{validationMessage}</p> : null}
        </section> : null}
        {step === "items" ? <div className="v2-invoice-lines" aria-label="Invoice line items">
          <div className="v2-invoice-lines-header">
            <span>Line items</span>
            <button type="button" onClick={addLine}><Plus size={14} />Add item</button>
          </div>
          {removedLine ? (
            <div className="v2-inline-undo" role="status">
              <span>{removedLine.line.description.trim() || "Line item"} removed.</span>
              <button type="button" onClick={undoRemoveLine}>Undo</button>
            </div>
          ) : null}
          {lines.map((line) => {
            const signal = lineSignals.find((item) => item.lineId === line.id)?.signal;
            return (
              <div className="v2-invoice-line-group" key={line.id}>
                <div className="v2-invoice-line">
                  <label>
                    <span>Description</span>
                    <input aria-label="Line description" value={line.description} placeholder="Work or material" onChange={(event) => updateLine(line.id, "description", event.target.value)} />
                  </label>
                  <label>
                    <span>Quantity</span>
                    <input type="number" min="0" step="0.5" value={line.qty} aria-label={`${line.description || "Line"} quantity`} onChange={(event) => updateLine(line.id, "qty", Number(event.target.value) || 0)} />
                  </label>
                  <label>
                    <span>Rate</span>
                    <input type="number" min="0" step="0.01" value={line.rate} aria-label={`${line.description || "Line"} rate`} onChange={(event) => updateLine(line.id, "rate", Number(event.target.value) || 0)} />
                  </label>
                  <div className="v2-invoice-line-total">
                    <span>Total</span>
                    <strong>{currency(centsToDollars(lineTotalCents(line)))}</strong>
                  </div>
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
          {delivery?.status === "sent" && hasUnsentChanges ? (
            <p className="v2-estimate-delivery-status is-changed">Changes made after the last email have not been sent.</p>
          ) : null}
          {delivery?.status === "sent" && !hasUnsentChanges ? (
            <p className="v2-estimate-delivery-status is-sent">Emailed to {delivery.recipientEmail}{delivery.sentAt ? ` on ${new Date(delivery.sentAt).toLocaleString()}` : ""}.</p>
          ) : null}
          {delivery?.status === "failed" ? (
            <p className="v2-estimate-delivery-status is-failed">The last email did not complete. Check the customer email and try again.</p>
          ) : null}
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
            <div><span>Method</span><strong>{customerPaymentMethod || "Not selected"}</strong></div>
          </div>
          <p className="v2-tool-note">
            {paymentChoice === "bank"
              ? "Email includes the secure customer pay button and records delivery."
              : "Email includes the payment instructions you entered and records delivery."}
          </p>
          {!isValidEmail(recipientEmail) ? (
            <p className="v2-tool-note">Add a valid recipient email in Customer before delivery. Copy and print remain available.</p>
          ) : null}
          <div className="v2-invoice-delivery" aria-label="Invoice draft delivery">
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
          <article className={`v2-invoice-print-preview is-template-${documentBrand.invoiceStyle}`} aria-label="Printable invoice preview">
              <DocumentBrandHeader
                brand={documentBrand}
                documentLabel="Invoice"
                documentNumber={invoiceNumber || "DRAFT"}
                status={delivery?.status === "sent" && !hasUnsentChanges ? "Invoice sent" : hasUnsentChanges ? "Invoice update draft" : "Invoice draft"}
              />
              <section className="v2-invoice-preview-meta">
                <div><span>Bill to</span><strong>{billTo || "Contractor / company"}</strong></div>
                {documentCustomerSnapshot?.billingAddress ? <div><span>Billing address</span><strong>{documentCustomerSnapshot.billingAddress}</strong></div> : null}
                <div><span>Pay to</span><strong>{payTo || "Your company / name"}</strong></div>
                <div><span>Invoice date</span><strong>{issueDate}</strong></div>
                {dueDate ? <div><span>Due date</span><strong>{dueDate}</strong></div> : null}
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
                {customerNote.trim() ? <p>{customerNote.trim()}</p> : null}
                {paymentChoice === "bank" ? (
                  <>
                    <span>Secure bank payment</span>
                    {bankPaymentUrl ? (
                      <a href={bankPaymentUrl} target="_blank" rel="noreferrer">Pay securely by bank</a>
                    ) : (
                      <strong>Pay link will be created before email delivery.</strong>
                    )}
                    <p>Payment is processed by Stripe for {payTo || "the sender"}. RIVT does not hold job funds.</p>
                  </>
                ) : (
                  <>
                    <span>Payment instructions</span>
                    <strong>{paymentMethod.trim() || "Not entered"}</strong>
                    <p>Use the sender's instructions above. RIVT records the invoice but does not collect this payment.</p>
                  </>
                )}
                <small className="v2-document-powered-by">Created with RIVT.</small>
              </footer>
          </article>
          <div className="v2-invoice-preview-actions" aria-label="Invoice preview actions">
            <button type="button" className="v2-secondary-button" onClick={() => void copyInvoice()}><Copy size={16} />Copy invoice</button>
            <button type="button" className="v2-secondary-button" onClick={printInvoice}><FileText size={16} />Print / save as PDF</button>
            <button type="button" className="v2-secondary-button" onClick={startBlankInvoice}><Plus size={16} />New invoice</button>
          </div>
        </Panel>
      </aside> : null}
      <div className="v2-tool-action-dock" aria-label="Invoice actions">
        <span aria-live="polite" data-save-state={draftSaveState}><strong>{currency(total)}</strong><small>{draftSaveMessage}</small></span>
        {step !== "items" ? <button type="button" onClick={() => setStep(step === "review" ? "customer" : "items")} aria-label="Previous invoice step"><ChevronLeft size={18} /></button> : null}
        <button type="button" className="v2-secondary-button" onClick={() => void saveInvoiceDraft()} disabled={projectInvoiceBusy || invoiceEmailBusy || draftSaveState === "saving"}>
          {draftSaveState === "saving" ? <LoaderCircle className="v2-spin" size={18} /> : draftSaveState === "saved" ? <Check size={18} /> : <Save size={18} />}
          {draftSaveState === "saving" ? "Saving" : draftSaveState === "saved" ? "Saved" : draftSaveState === "error" ? "Try again" : "Save draft"}
        </button>
        {step === "items" ? <button type="button" className="v2-primary-button" onClick={() => setStep("customer")} disabled={totalCents <= 0}><span>Customer</span><ChevronRight size={18} /></button> : null}
        {step === "customer" ? <button type="button" className="v2-primary-button" onClick={openInvoiceReview}><span>Review</span><ChevronRight size={18} /></button> : null}
        {step === "review" ? <button type="button" className="v2-primary-button" onClick={() => void emailInvoice()} disabled={invoiceEmailBusy || totalCents <= 0 || !isValidEmail(recipientEmail)}><Mail size={18} />{invoiceEmailBusy ? "Sending" : delivery?.status === "sent" ? "Send update" : paymentChoice === "bank" ? "Send link" : "Email invoice"}</button> : null}
      </div>
    </div>
  );
}

