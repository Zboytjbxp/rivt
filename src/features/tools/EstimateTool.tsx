import { Check, ChevronLeft, ChevronRight, Copy, FileText, LoaderCircle, Mail, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Panel } from "../../components/ui";
import { requestKey } from "../../lib/api";
import type { Job } from "../../types";
import { readPrimaryHourlyRate } from "../../lib/rateCard";
import { CustomerPicker } from "../clients/CustomerPicker";
import {
  customerSnapshot,
  type ClientRecord,
  type CustomerSnapshot,
} from "../clients/client-records";
import { getEstimatePriceSignal } from "./priceGuidance";
import { centsToDollars, currency, toCents } from "./money";
import { deleteToolRecordByLocalId, fetchToolRecords, sendEstimateByLocalId, upsertToolRecord, type ServerToolRecord } from "./tool-records-api";
import { toolContextLabel, toolContextRecordFields, toolContextStorageId, type ToolWorkContext } from "./tool-work-context";
import { DocumentBrandHeader, DocumentStylePicker } from "./DocumentBrandControls";
import {
  defaultDocumentBrand,
  fetchDocumentBrand,
  saveDocumentBrand,
  type DocumentBrand,
  type DocumentStyle,
} from "./document-brand-api";

function formatNumber(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export interface EstimateInvoiceDraftLine {
  description: string;
  qty: number;
  rate: number;
  kind?: "labor" | "material" | "other" | "adjustment";
}

export interface EstimateInvoiceDraft {
  invoiceNumber: string;
  templateName: string;
  billTo: string;
  recipientEmail: string;
  terms: string;
  paymentMethod: string;
  lines: EstimateInvoiceDraftLine[];
  sourceNote: string;
  customerId: string | null;
  customerSnapshot: CustomerSnapshot | null;
}

interface EstimatePrefs {
  hourlyRate: number;
  crewSize: number;
  overheadPct: number;
  marginPct: number;
  contingencyPct: number;
}

const estimatePrefsStorageKey = "rivt.estimatePrefs.v1";
const estimateTemplateStorageKey = "rivt.estimateTemplates.v1";

interface EstimateTemplate {
  id: string;
  name: string;
  savedAt: string;
  laborHours: number;
  hourlyRate: number;
  crewSize: number;
  materials: number;
  subCosts: number;
  overheadPct: number;
  marginPct: number;
  contingencyPct: number;
  scope: string;
  customerNote: string;
}

interface EstimateDraftState {
  localId?: string;
  laborHours: number;
  hourlyRate: number;
  crewSize: number;
  materials: number;
  subCosts: number;
  overheadPct: number;
  marginPct: number;
  contingencyPct: number;
  estimateNumber: string;
  estimateDate: string;
  recipientName: string;
  recipientEmail: string;
  scope: string;
  validThrough: string;
  customerNote: string;
  customerId: string | null;
  customerSnapshot: CustomerSnapshot | null;
}

interface EstimateDelivery {
  status: "sent" | "failed";
  recipientEmail: string;
  attemptedAt: string;
  sentAt?: string;
  attemptCount: number;
  documentFingerprint?: string;
}

function estimateDraftStorageKey(context: ToolWorkContext) {
  return `rivt.estimateDraft.v2:${toolContextStorageId(context)}`;
}

function readEstimateDraft(context: ToolWorkContext): Partial<EstimateDraftState> {
  try {
    const parsed = JSON.parse(localStorage.getItem(estimateDraftStorageKey(context)) || "{}") as Partial<EstimateDraftState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function estimateDraftFromRecord(record: ServerToolRecord | null | undefined): Partial<EstimateDraftState> {
  if (!record || record.recordType !== "estimate") return {};
  const payload = record.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Partial<EstimateDraftState>
    : {};
}

function clampEstimateNumber(value: unknown, fallback: number, min = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, parsed) : fallback;
}

function futureDate(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return localDate(value);
}

function localDate(value = new Date()) {
  const localValue = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return localValue.toISOString().slice(0, 10);
}

function today() {
  return localDate();
}

function newEstimateNumber() {
  return `EST-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function deliveryFromRecord(record: ServerToolRecord | null): EstimateDelivery | null {
  const delivery = record?.payload?.delivery;
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) return null;
  const candidate = delivery as Partial<EstimateDelivery>;
  if (candidate.status !== "sent" && candidate.status !== "failed") return null;
  if (typeof candidate.recipientEmail !== "string" || typeof candidate.attemptedAt !== "string") return null;
  return {
    status: candidate.status,
    recipientEmail: candidate.recipientEmail,
    attemptedAt: candidate.attemptedAt,
    sentAt: typeof candidate.sentAt === "string" ? candidate.sentAt : undefined,
    attemptCount: typeof candidate.attemptCount === "number" && Number.isInteger(candidate.attemptCount) ? candidate.attemptCount : 1,
    documentFingerprint: typeof candidate.documentFingerprint === "string" ? candidate.documentFingerprint : undefined,
  };
}

function readEstimatePrefs(): EstimatePrefs {
  const fallback: EstimatePrefs = {
    hourlyRate: readPrimaryHourlyRate(0),
    crewSize: 1,
    overheadPct: 12,
    marginPct: 18,
    contingencyPct: 7,
  };
  try {
    const stored = localStorage.getItem(estimatePrefsStorageKey);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored) as Partial<EstimatePrefs>;
    return {
      hourlyRate: clampEstimateNumber(parsed.hourlyRate, fallback.hourlyRate),
      crewSize: clampEstimateNumber(parsed.crewSize, fallback.crewSize, 1),
      overheadPct: clampEstimateNumber(parsed.overheadPct, fallback.overheadPct),
      marginPct: clampEstimateNumber(parsed.marginPct, fallback.marginPct),
      contingencyPct: clampEstimateNumber(parsed.contingencyPct, fallback.contingencyPct),
    };
  } catch {
    return fallback;
  }
}

function isEstimateTemplate(value: unknown): value is EstimateTemplate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EstimateTemplate>;
  return typeof candidate.id === "string"
    && typeof candidate.name === "string"
    && typeof candidate.savedAt === "string"
    && typeof candidate.laborHours === "number"
    && typeof candidate.hourlyRate === "number"
    && typeof candidate.crewSize === "number"
    && typeof candidate.materials === "number"
    && typeof candidate.subCosts === "number"
    && typeof candidate.overheadPct === "number"
    && typeof candidate.marginPct === "number"
    && typeof candidate.contingencyPct === "number"
    && typeof candidate.scope === "string"
    && typeof candidate.customerNote === "string";
}

function readEstimateTemplates(): EstimateTemplate[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(estimateTemplateStorageKey) || "[]") as unknown[];
    return Array.isArray(parsed) ? parsed.filter(isEstimateTemplate).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function estimateTemplateFromServer(record: ServerToolRecord): EstimateTemplate | null {
  if (!isEstimateTemplate(record.payload)) return null;
  return {
    ...record.payload,
    id: record.localId,
    name: record.payload.name || record.title,
    savedAt: record.payload.savedAt || record.updatedAt || new Date().toISOString(),
  };
}

function estimateTemplateToServerInput(template: EstimateTemplate) {
  return {
    recordType: "estimate_template" as const,
    localId: template.id,
    title: template.name || "Estimate template",
    status: "active",
    recordDate: template.savedAt.slice(0, 10),
    amountCents: null,
    payload: { ...template },
  };
}

export function EstimateTool({
  activeJob,
  workContext,
  onConvertToInvoice,
  initialRecord = null,
}: {
  activeJob: Job | null;
  workContext: ToolWorkContext;
  onConvertToInvoice?: (draft: EstimateInvoiceDraft) => void;
  initialRecord?: ServerToolRecord | null;
}) {
  const [estimatePrefs] = useState(readEstimatePrefs);
  const [initialDraft] = useState(() => ({
    ...readEstimateDraft(workContext),
    ...estimateDraftFromRecord(initialRecord),
  }));
  const [recordLocalId, setRecordLocalId] = useState(initialRecord?.localId ?? initialDraft.localId ?? `estimate:${toolContextStorageId(workContext)}`);
  const [laborHours, setLaborHours] = useState(initialDraft.laborHours ?? activeJob?.durationHours ?? 0);
  const [hourlyRate, setHourlyRate] = useState(initialDraft.hourlyRate ?? estimatePrefs.hourlyRate);
  const [crewSize, setCrewSize] = useState(initialDraft.crewSize ?? estimatePrefs.crewSize);
  const [materials, setMaterials] = useState(initialDraft.materials ?? 0);
  const [subCosts, setSubCosts] = useState(initialDraft.subCosts ?? 0);
  const [overheadPct, setOverheadPct] = useState(initialDraft.overheadPct ?? estimatePrefs.overheadPct);
  const [marginPct, setMarginPct] = useState(initialDraft.marginPct ?? estimatePrefs.marginPct);
  const [contingencyPct, setContingencyPct] = useState(initialDraft.contingencyPct ?? estimatePrefs.contingencyPct);
  const [estimateNumber, setEstimateNumber] = useState(initialDraft.estimateNumber ?? newEstimateNumber());
  const [estimateDate, setEstimateDate] = useState(initialDraft.estimateDate ?? today());
  const [recipientName, setRecipientName] = useState(initialDraft.recipientName ?? (workContext.kind === "standalone" ? workContext.project.clientName : activeJob?.contractor ?? ""));
  const [recipientEmail, setRecipientEmail] = useState(initialDraft.recipientEmail ?? "");
  const [scope, setScope] = useState(initialDraft.scope ?? activeJob?.title ?? (workContext.kind === "standalone" ? workContext.project.title : ""));
  const [validThrough, setValidThrough] = useState(initialDraft.validThrough ?? futureDate(30));
  const [customerNote, setCustomerNote] = useState(initialDraft.customerNote ?? "");
  const [customerId, setCustomerId] = useState<string | null>(
    initialDraft.customerId
      ?? initialRecord?.customerId
      ?? (workContext.kind === "standalone" ? workContext.project.customerId : null),
  );
  const [selectedCustomerSnapshot, setSelectedCustomerSnapshot] = useState<CustomerSnapshot | null>(initialDraft.customerSnapshot ?? null);
  const [saveMessage, setSaveMessage] = useState(initialRecord ? "Loaded from your RIVT account." : "Autosaved on this device.");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(initialRecord ? "saved" : "idle");
  const [delivery, setDelivery] = useState<EstimateDelivery | null>(null);
  const [lastSentFingerprint, setLastSentFingerprint] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<"price" | "customer" | "review">("price");
  const [documentBrand, setDocumentBrand] = useState<DocumentBrand>(() => defaultDocumentBrand());
  const [brandMessage, setBrandMessage] = useState("Document style syncs to your RIVT account.");
  const [templates, setTemplates] = useState<EstimateTemplate[]>(readEstimateTemplates);
  const [templateName, setTemplateName] = useState("Standard estimate");
  const [templateNotice, setTemplateNotice] = useState("");
  const [templateSyncMessage, setTemplateSyncMessage] = useState("Templates sync to your RIVT account.");
  const sendIdempotencyKeyRef = useRef<string | null>(null);
  const localDraftStorageKey = estimateDraftStorageKey(workContext);

  useEffect(() => {
    let cancelled = false;
    void fetchDocumentBrand()
      .then((brand) => {
        if (!cancelled) setDocumentBrand(brand);
      })
      .catch(() => {
        if (!cancelled) setBrandMessage("Using the standard document style until account branding can load.");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchToolRecords("estimate_template").then((serverRecords) => {
      if (cancelled) return;
      if (!serverRecords) {
        setTemplateSyncMessage("Saved on this device. Account sync is currently unavailable.");
        return;
      }
      const mapped = serverRecords
        .map(estimateTemplateFromServer)
        .filter((template): template is EstimateTemplate => Boolean(template))
        .slice(0, 8);
      if (mapped.length) {
        setTemplates(mapped);
        try { localStorage.setItem(estimateTemplateStorageKey, JSON.stringify(mapped)); } catch { /* optional cache */ }
        setTemplateSyncMessage("Synced to your RIVT account.");
        return;
      }
      const localTemplates = readEstimateTemplates();
      if (localTemplates.length) {
        void Promise.all(localTemplates.map((template) => upsertToolRecord(estimateTemplateToServerInput(template))))
          .then((results) => {
            if (!cancelled) {
              setTemplateSyncMessage(results.some(Boolean)
                ? "Local templates synced to your RIVT account."
                : "Saved on this device. Account sync is currently unavailable.");
            }
          });
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(estimatePrefsStorageKey, JSON.stringify({
        hourlyRate,
        crewSize,
        overheadPct,
        marginPct,
        contingencyPct,
      }));
    } catch {
      // Estimate preferences are optional; defaults still work when storage is unavailable.
    }
  }, [contingencyPct, crewSize, hourlyRate, marginPct, overheadPct]);

  useEffect(() => {
    const draft: EstimateDraftState = {
      localId: recordLocalId,
      laborHours, hourlyRate, crewSize, materials, subCosts, overheadPct, marginPct, contingencyPct,
      estimateNumber, estimateDate, recipientName, recipientEmail, scope, validThrough, customerNote,
      customerId, customerSnapshot: selectedCustomerSnapshot,
    };
    try {
      localStorage.setItem(localDraftStorageKey, JSON.stringify(draft));
    } catch {
      queueMicrotask(() => {
        setSaveState("error");
        setSaveMessage("This draft could not be saved on this device. Keep this page open and copy your work.");
      });
    }
  }, [contingencyPct, crewSize, customerId, customerNote, estimateDate, estimateNumber, hourlyRate, laborHours, localDraftStorageKey, marginPct, materials, overheadPct, recipientEmail, recipientName, recordLocalId, scope, selectedCustomerSnapshot, subCosts, validThrough]);

  useEffect(() => {
    let active = true;
    void fetchToolRecords("estimate").then((records) => {
      const record = records?.find((candidate) => candidate.localId === recordLocalId) ?? null;
      if (active) {
        setDelivery(deliveryFromRecord(record));
        const recordDelivery = deliveryFromRecord(record);
        const fingerprint = recordDelivery?.documentFingerprint
          ?? (record?.status === "sent" && typeof record?.payload?.documentFingerprint === "string"
            ? record.payload.documentFingerprint
            : "");
        setLastSentFingerprint(fingerprint);
      }
    });
    return () => { active = false; };
  }, [recordLocalId]);

  const labor = laborHours * hourlyRate;
  const base = labor + materials + subCosts;
  const overhead = base * (overheadPct / 100);
  const margin = (base + overhead) * (marginPct / 100);
  const contingency = (base + overhead + margin) * (contingencyPct / 100);
  const calculatedTotal = base + overhead + margin + contingency;
  const target = Math.ceil(calculatedTotal / 25) * 25;
  const roundingAdjustment = Math.max(0, target - calculatedTotal);
  const low = Math.floor((target * 0.92) / 25) * 25;
  const high = Math.ceil((target * 1.12) / 25) * 25;
  const days = laborHours > 0 ? Math.max(0.5, laborHours / Math.max(1, crewSize) / 7) : 0;
  const marginShare = target > 0 ? Math.min(100, Math.round(((margin + contingency) / target) * 100)) : 0;
  const laborShare = target > 0 ? Math.min(100, Math.round((labor / target) * 100)) : 0;
  const priceSignal = getEstimatePriceSignal({
    title: activeJob?.title,
    trade: activeJob?.trade ?? null,
    target,
    hourlyRate,
    laborHours,
  });

  const customerLines = (() => {
    const baseLines = [
      { description: "Labor", quantity: Math.max(0.5, laborHours), baseTotal: Math.max(0, labor) },
      { description: "Materials and handling", quantity: 1, baseTotal: Math.max(0, materials) },
      { description: "Specialty costs", quantity: 1, baseTotal: Math.max(0, subCosts) },
    ].filter((line) => line.baseTotal > 0);
    const allocationLines = baseLines.length ? baseLines : [{ description: scope.trim() || "Estimate scope", quantity: 1, baseTotal: target }];
    const baseTotal = allocationLines.reduce((sum, line) => sum + line.baseTotal, 0);
    const targetCents = Math.max(0, toCents(target));
    let allocatedCents = 0;
    return allocationLines.map((line, index) => {
      const totalCents = index === allocationLines.length - 1
        ? targetCents - allocatedCents
        : Math.round(targetCents * (line.baseTotal / Math.max(1, baseTotal)));
      allocatedCents += totalCents;
      return { description: line.description, quantity: line.quantity, totalCents };
    });
  })();
  const documentCustomerSnapshot = customerId && selectedCustomerSnapshot
    ? {
        ...selectedCustomerSnapshot,
        customerId,
        displayName: recipientName.trim() || selectedCustomerSnapshot.displayName,
        email: recipientEmail.trim().toLowerCase(),
      }
    : null;
  const documentFingerprint = JSON.stringify({
    estimateNumber,
    estimateDate,
    recipientName: recipientName.trim(),
    recipientEmail: recipientEmail.trim().toLowerCase(),
    scope: scope.trim(),
    validThrough,
    customerNote: customerNote.trim(),
    customerId,
    customerSnapshot: documentCustomerSnapshot,
    targetCents: toCents(target),
    customerLines,
    documentBrand: {
      businessName: documentBrand.businessName,
      estimateStyle: documentBrand.estimateStyle,
      logoUploadId: documentBrand.logoUploadId,
      updatedAt: documentBrand.updatedAt,
    },
  });
  const hasUnsentChanges = delivery?.status === "sent"
    && Boolean(lastSentFingerprint)
    && lastSentFingerprint !== documentFingerprint;

  useEffect(() => {
    sendIdempotencyKeyRef.current = null;
  }, [customerId, customerNote, documentBrand.updatedAt, estimateDate, estimateNumber, recipientEmail, recipientName, scope, selectedCustomerSnapshot, validThrough, target]);

  async function copyCustomerEstimate() {
    const summary = [
      `${documentBrand.businessName || "RIVT member"} estimate ${estimateNumber}`,
      `Date: ${estimateDate}`,
      `Prepared for: ${recipientName.trim() || "Customer"}`,
      `Scope: ${scope.trim() || "Estimate scope"}`,
      "",
      ...customerLines.map((line) => `${line.description}: ${currency(centsToDollars(line.totalCents))}`),
      "",
      `Estimated total: ${currency(target)}`,
      `Valid through: ${validThrough}`,
      customerNote.trim() ? `Note: ${customerNote.trim()}` : "",
      "",
      "This is an estimate, not a payment request.",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      setSaveMessage("Estimate copied.");
    } catch {
      setSaveMessage("Copy failed. Select the estimate text and try again.");
    }
  }

  async function changeEstimateStyle(style: DocumentStyle) {
    const previous = documentBrand;
    const next = { ...documentBrand, estimateStyle: style };
    setDocumentBrand(next);
    setBrandMessage("Saving document style...");
    try {
      const saved = await saveDocumentBrand(next);
      setDocumentBrand(saved);
      setBrandMessage(`${style === "classic" ? "Classic" : style === "compact" ? "Compact" : "Field"} style saved for future estimates.`);
    } catch {
      setDocumentBrand(previous);
      setBrandMessage("Document style could not be saved. Your previous style is still active.");
    }
  }

  function persistEstimateTemplates(nextTemplates: EstimateTemplate[], notice: string, changedTemplate?: EstimateTemplate) {
    const limited = nextTemplates.slice(0, 8);
    setTemplates(limited);
    setTemplateNotice(notice);
    try {
      localStorage.setItem(estimateTemplateStorageKey, JSON.stringify(limited));
    } catch {
      setTemplateNotice("Template could not be saved on this device.");
    }
    if (!changedTemplate) return;
    void upsertToolRecord(estimateTemplateToServerInput(changedTemplate)).then((record) => {
      setTemplateSyncMessage(record
        ? "Synced to your RIVT account."
        : "Saved on this device. Account sync is currently unavailable.");
    });
  }

  function saveEstimateTemplate() {
    const cleanName = templateName.trim() || "Estimate template";
    const template: EstimateTemplate = {
      id: crypto.randomUUID(),
      name: cleanName,
      savedAt: new Date().toISOString(),
      laborHours,
      hourlyRate,
      crewSize,
      materials,
      subCosts,
      overheadPct,
      marginPct,
      contingencyPct,
      scope,
      customerNote,
    };
    persistEstimateTemplates(
      [template, ...templates.filter((item) => item.name.toLowerCase() !== cleanName.toLowerCase())],
      "Template saved without customer identity or estimate number.",
      template,
    );
  }

  function loadEstimateTemplate(template: EstimateTemplate) {
    markDraftChanged();
    setTemplateName(template.name);
    setLaborHours(template.laborHours);
    setHourlyRate(template.hourlyRate);
    setCrewSize(template.crewSize);
    setMaterials(template.materials);
    setSubCosts(template.subCosts);
    setOverheadPct(template.overheadPct);
    setMarginPct(template.marginPct);
    setContingencyPct(template.contingencyPct);
    setScope(template.scope);
    setCustomerNote(template.customerNote);
    setTemplateNotice(`Loaded ${template.name}. Customer and estimate identity were kept separate.`);
  }

  function deleteEstimateTemplate(templateId: string) {
    persistEstimateTemplates(templates.filter((template) => template.id !== templateId), "Template removed from this device.");
    void deleteToolRecordByLocalId("estimate_template", templateId).then((ok) => {
      setTemplateSyncMessage(ok
        ? "Deleted from this device and your RIVT account."
        : "Deleted on this device only. Account sync is currently unavailable.");
    });
  }

  function printEstimate() {
    setSaveMessage("Print dialog opened. Choose Save as PDF to download a copy.");
    window.print();
  }

  function markDraftChanged() {
    setSaveState("idle");
    setSaveMessage("Saved on this device. Save to sync these changes to your RIVT account.");
  }

  function validateCustomerStep(requireEmail = false) {
    if (!estimateNumber.trim()) return "Add an estimate number.";
    if (!estimateDate) return "Choose the estimate date.";
    if (!recipientName.trim()) return "Add the customer or company name.";
    if (requireEmail && !isValidEmail(recipientEmail)) return "Add a valid customer email.";
    if (recipientEmail.trim() && !isValidEmail(recipientEmail)) return "Check the customer email or leave it blank for print-only review.";
    if (!scope.trim()) return "Describe the work covered by this estimate.";
    if (!validThrough) return "Choose how long this estimate is valid.";
    if (estimateDate && validThrough < estimateDate) return "Valid through cannot be before the estimate date.";
    return "";
  }

  function openReview() {
    const message = validateCustomerStep();
    setValidationMessage(message);
    if (message) return;
    setStep("review");
  }

  function startNewEstimate() {
    const nextId = `estimate:${toolContextStorageId(workContext)}:${crypto.randomUUID()}`;
    setRecordLocalId(nextId);
    setEstimateNumber(newEstimateNumber());
    setEstimateDate(today());
    setLaborHours(activeJob?.durationHours ?? 0);
    setHourlyRate(readEstimatePrefs().hourlyRate);
    setCrewSize(readEstimatePrefs().crewSize);
    setMaterials(0);
    setSubCosts(0);
    setRecipientName(workContext.kind === "standalone" ? workContext.project.clientName : activeJob?.contractor ?? "");
    setRecipientEmail("");
    setScope(activeJob?.title ?? (workContext.kind === "standalone" ? workContext.project.title : ""));
    setValidThrough(futureDate(30));
    setCustomerNote("");
    setCustomerId(null);
    setSelectedCustomerSnapshot(null);
    setDelivery(null);
    setLastSentFingerprint("");
    setValidationMessage("");
    setSaveState("idle");
    setSaveMessage("New estimate started. No price has been assumed.");
    setStep("price");
  }

  async function saveDraft(showSuccess = true) {
    setSaveState("saving");
    if (showSuccess) setSaveMessage("Saving draft...");
    const draft: EstimateDraftState = {
      localId: recordLocalId,
      laborHours, hourlyRate, crewSize, materials, subCosts, overheadPct, marginPct, contingencyPct,
      estimateNumber, estimateDate, recipientName, recipientEmail, scope, validThrough, customerNote,
      customerId, customerSnapshot: documentCustomerSnapshot,
    };
    const record = await upsertToolRecord({
      recordType: "estimate",
      localId: recordLocalId,
      title: (scope.trim() || `${toolContextLabel(workContext)} estimate`).slice(0, 160),
      status: delivery?.status === "sent" && !hasUnsentChanges ? "sent" : "draft",
      recordDate: estimateDate,
      amountCents: toCents(target),
      payload: { ...draft, target, low, high, customerLines, documentFingerprint, delivery: delivery ?? undefined },
      customerId,
      ...toolContextRecordFields(workContext),
    });
    if (record) {
      setDelivery(deliveryFromRecord(record));
      setSaveState("saved");
      if (showSuccess) setSaveMessage("Draft saved to your RIVT account.");
    } else if (showSuccess) {
      setSaveState("error");
      setSaveMessage("Saved on this device only. Account sync failed.");
    } else {
      setSaveState("error");
    }
    return record;
  }

  async function sendEstimateEmail() {
    const customerError = validateCustomerStep(true);
    if (customerError) {
      setStep("customer");
      setValidationMessage(customerError);
      setSaveMessage(customerError);
      setSaveState("error");
      return;
    }
    if (target <= 0) {
      setSaveMessage("Add a price before sending.");
      return;
    }
    setSending(true);
    const saved = await saveDraft(false);
    if (!saved) {
      setSaveMessage("RIVT could not save this estimate. Check your connection and try again.");
      setSending(false);
      return;
    }
    try {
      const idempotencyKey = sendIdempotencyKeyRef.current ?? requestKey();
      sendIdempotencyKeyRef.current = idempotencyKey;
      const sent = await sendEstimateByLocalId(saved.localId, idempotencyKey);
      const sentDelivery = deliveryFromRecord(sent);
      setDelivery(sentDelivery);
      setLastSentFingerprint(documentFingerprint);
      sendIdempotencyKeyRef.current = null;
      setSaveMessage(sentDelivery?.sentAt ? `Sent to ${sentDelivery.recipientEmail}.` : "Estimate sent.");
      setSaveState("saved");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "RIVT could not send the estimate.");
      setSaveState("error");
    } finally {
      setSending(false);
    }
  }

  function chooseCustomer(customer: ClientRecord | null) {
    markDraftChanged();
    if (!customer) {
      setCustomerId(null);
      setSelectedCustomerSnapshot(null);
      return;
    }
    const snapshot = customerSnapshot(customer);
    setCustomerId(customer.id);
    setSelectedCustomerSnapshot(snapshot);
    setRecipientName(snapshot.displayName);
    setRecipientEmail(snapshot.email);
  }

  function convertToInvoice() {
    const title = activeJob?.title?.trim() || (workContext.kind === "standalone" ? workContext.project.title : "Estimate");
    const targetCents = Math.max(0, toCents(target));
    const baseLines = [
      {
        description: `${title} labor`,
        qty: Math.max(0.5, laborHours),
        baseTotal: Math.max(0, labor),
        kind: "labor" as const,
      },
      {
        description: `${title} materials and handling`,
        qty: 1,
        baseTotal: Math.max(0, materials),
        kind: "material" as const,
      },
      {
        description: `${title} specialty costs`,
        qty: 1,
        baseTotal: Math.max(0, subCosts),
        kind: "other" as const,
      },
    ].filter((line) => line.baseTotal > 0);

    const allocationLines = baseLines.length
      ? baseLines
      : [{ description: `${title} scope`, qty: 1, baseTotal: target, kind: "other" as const }];

    const baseTotal = allocationLines.reduce((sum, line) => sum + line.baseTotal, 0);
    let allocatedCents = 0;
    const draftLines: EstimateInvoiceDraftLine[] = allocationLines.map((line, index) => {
      const isLast = index === allocationLines.length - 1;
      const lineCents = isLast
        ? targetCents - allocatedCents
        : Math.round(targetCents * (line.baseTotal / Math.max(1, baseTotal)));
      allocatedCents += lineCents;
      return {
        description: line.description,
        qty: line.qty,
        rate: centsToDollars(lineCents) / Math.max(0.5, line.qty),
        kind: line.kind,
      };
    });

    onConvertToInvoice?.({
      invoiceNumber: `RIVT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      templateName: `${title} invoice`,
      billTo: recipientName.trim() || activeJob?.contractor || (workContext.kind === "standalone" ? workContext.project.clientName : ""),
      recipientEmail: recipientEmail.trim(),
      terms: documentCustomerSnapshot?.defaultTerms?.trim() || "Due on completion",
      paymentMethod: "",
      lines: draftLines,
      sourceNote: `Converted from estimate total ${currency(target)} (${currency(low)} - ${currency(high)}). Overhead, profit markup, and contingency are included in the line rates. Review scope, tax, and payment terms before sending.`,
      customerId,
      customerSnapshot: documentCustomerSnapshot,
    });
  }

  return (
    <div className={`v2-tool-workbench v2-estimate-workbench is-${step}`} onChangeCapture={markDraftChanged}>
      <nav className="v2-tool-flow-nav" aria-label="Estimate steps">
        {(["price", "customer", "review"] as const).map((item, index) => (
          <button key={item} type="button" aria-current={step === item ? "step" : undefined} onClick={() => setStep(item)}>
            <span>{index + 1}</span>{item === "price" ? "Price" : item === "customer" ? "Customer" : "Review"}
          </button>
        ))}
      </nav>

      <Panel className="v2-tool-panel v2-estimate-builder-panel" eyebrow={`Step ${step === "price" ? 1 : step === "customer" ? 2 : 3} of 3`} title={step === "price" ? "Price the work" : step === "customer" ? "Add the customer" : "Preview and send"}>
        {step === "price" ? <>
          <section className="v2-estimate-hero" aria-label="Estimate target">
            <span>{target > 0 ? "Calculated estimate" : "Enter real job costs"}</span>
            <strong>{currency(target)}</strong>
            <small>{target > 0
              ? `${currency(low)} - ${currency(high)} planning range${days > 0 ? ` / ${formatNumber(days, 1)} working days` : " / add labor hours for a timeline"}`
              : "RIVT will not assume labor or material prices."}</small>
          </section>
          <div className="v2-estimate-quick-stats" aria-label="Estimate quick stats">
            <article><span>Labor</span><strong>{currency(labor)}</strong></article>
            <article><span>Material</span><strong>{currency(materials)}</strong></article>
            <article><span>Profit + reserve</span><strong>{marginShare}%</strong></article>
          </div>
          <div className="v2-tool-input-grid v2-estimate-input-grid">
            <label>Labor hours<input type="number" min="0" step="0.5" value={laborHours} onChange={(event) => setLaborHours(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Hourly rate<input type="number" min="0" step="0.01" value={hourlyRate} onChange={(event) => setHourlyRate(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Crew size<input type="number" min="1" value={crewSize} onChange={(event) => setCrewSize(Math.max(1, Number(event.target.value) || 1))} /></label>
            <label>Materials<input type="number" min="0" value={materials} onChange={(event) => setMaterials(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Sub costs<input type="number" min="0" value={subCosts} onChange={(event) => setSubCosts(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Overhead %<input type="number" min="0" value={overheadPct} onChange={(event) => setOverheadPct(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Profit markup %<input type="number" min="0" value={marginPct} onChange={(event) => setMarginPct(Math.max(0, Number(event.target.value) || 0))} /></label>
            <label>Contingency %<input type="number" min="0" value={contingencyPct} onChange={(event) => setContingencyPct(Math.max(0, Number(event.target.value) || 0))} /></label>
          </div>
          <details className="v2-tool-collapsible v2-invoice-template-tools" aria-label="Estimate templates">
            <summary>
              <span>Templates</span>
              <small>{templates.length ? `${templates.length} saved` : "Optional"}</small>
            </summary>
            <section className="v2-invoice-template-bar">
              <label>Template name<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Standard service estimate" /></label>
              <button type="button" className="v2-primary-button" onClick={saveEstimateTemplate}><FileText size={14} />Save template</button>
              <small>{templateSyncMessage}</small>
            </section>
            <small className="v2-invoice-template-boundary">
              Templates save pricing setup, scope, and notes—not customer identity, dates, or estimate numbers.
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
                    <button type="button" onClick={() => loadEstimateTemplate(template)}>Load</button>
                    <button type="button" aria-label={`Delete ${template.name}`} onClick={() => deleteEstimateTemplate(template.id)}><Trash2 size={14} /></button>
                  </article>
                ))}
              </div>
            ) : null}
          </details>
        </> : null}

        {step === "customer" ? <section className="v2-estimate-delivery" aria-labelledby="estimate-delivery-title">
          <div>
            <span>Customer copy</span>
            <strong id="estimate-delivery-title">{recipientEmail.trim() ? "Customer details ready" : "Who should receive this?"}</strong>
          </div>
          <CustomerPicker selectedCustomerId={customerId} onSelect={chooseCustomer} />
          <div className="v2-tool-input-grid v2-estimate-delivery-grid">
            <label>Customer name<input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Customer or company" /></label>
            <label>Customer email<input type="email" inputMode="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="name@example.com" /></label>
            <label>Estimate number<input value={estimateNumber} onChange={(event) => setEstimateNumber(event.target.value)} aria-label="Estimate number" /></label>
            <label>Estimate date<input type="date" value={estimateDate} onChange={(event) => setEstimateDate(event.target.value)} /></label>
            <label>Valid through<input type="date" value={validThrough} onChange={(event) => setValidThrough(event.target.value)} /></label>
            <label className="is-wide">Scope<textarea value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Describe the work covered by this estimate." rows={3} /></label>
            <label className="is-wide">Customer note<textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} placeholder="Optional note, exclusions, or next steps." rows={3} /></label>
          </div>
          <DocumentStylePicker
            label="Estimate appearance"
            value={documentBrand.estimateStyle}
            onChange={(style) => void changeEstimateStyle(style)}
            footer={<small className="v2-document-style-status">{brandMessage} Logo and business details are managed in Profile → Business.</small>}
          />
          {validationMessage ? <p className="v2-record-error" role="alert">{validationMessage}</p> : null}
        </section> : null}

        {step === "review" ? <section className="v2-estimate-delivery" aria-labelledby="estimate-review-title">
          <div>
            <span>Customer copy</span>
            <strong id="estimate-review-title">{recipientEmail.trim() ? `Ready for ${recipientEmail}` : "Add an email before sending"}</strong>
            <small>RIVT emails this estimate. It does not request payment or claim online approval.</small>
          </div>
          <article className={`v2-invoice-print-preview v2-estimate-print-preview is-template-${documentBrand.estimateStyle}`} aria-label="Printable estimate preview">
            <DocumentBrandHeader
              brand={documentBrand}
              documentLabel="Estimate"
              documentNumber={estimateNumber}
              status="Estimate"
            />
            <section className="v2-invoice-preview-meta">
              <div><span>Prepared for</span><strong>{recipientName || "Customer"}</strong></div>
              {documentCustomerSnapshot?.billingAddress ? <div><span>Billing address</span><strong>{documentCustomerSnapshot.billingAddress}</strong></div> : null}
              <div><span>Estimate date</span><strong>{estimateDate}</strong></div>
              <div><span>Scope</span><strong>{scope.trim() || "Estimate scope"}</strong></div>
              <div><span>Valid through</span><strong>{validThrough}</strong></div>
            </section>
            <table>
              <thead><tr><th>Description</th><th>Total</th></tr></thead>
              <tbody>{customerLines.map((line) => <tr key={line.description}><td>{line.description}</td><td>{currency(centsToDollars(line.totalCents))}</td></tr>)}</tbody>
            </table>
            <section className="v2-invoice-preview-totals"><div><span>Estimated total</span><strong>{currency(target)}</strong></div></section>
            <footer>
              {customerNote.trim() ? <p>{customerNote.trim()}</p> : null}
              <span>Estimate only</span>
              <p>This is not a payment request. Contact the sender to discuss changes or confirm acceptance.</p>
              <small className="v2-document-powered-by">Created with RIVT.</small>
            </footer>
          </article>
          <div className="v2-invoice-preview-actions" aria-label="Estimate preview actions">
            <button type="button" className="v2-secondary-button" onClick={() => void copyCustomerEstimate()}><Copy size={18} />Copy customer estimate</button>
            <button type="button" className="v2-secondary-button" onClick={printEstimate}><FileText size={18} />Print / save as PDF</button>
            {onConvertToInvoice ? <button type="button" className="v2-secondary-button" onClick={convertToInvoice} disabled={target <= 0}><FileText size={18} />Convert to invoice</button> : null}
          </div>
          {delivery?.status === "sent" && hasUnsentChanges ? <p className="v2-estimate-delivery-status is-changed">Changes made after the last email have not been sent.</p> : null}
          {delivery?.status === "sent" && !hasUnsentChanges ? <p className="v2-estimate-delivery-status is-sent">Sent to {delivery.recipientEmail} {delivery.sentAt ? `on ${new Date(delivery.sentAt).toLocaleString()}` : ""}. Confirm acceptance, then convert it to an invoice when the work is ready.</p> : null}
          {delivery?.status === "failed" ? <p className="v2-estimate-delivery-status is-failed">The last delivery did not complete. Check the recipient email and try again.</p> : null}
          <button type="button" className="v2-secondary-button v2-tool-inline-action" onClick={startNewEstimate}><Plus size={18} />New estimate</button>
        </section> : null}
      </Panel>

      {step === "review" ? <Panel as="aside" className="v2-tool-panel v2-tool-summary-panel" eyebrow="Internal check" title={`${currency(low)} - ${currency(high)}`}>
        <section className={`v2-price-signal is-${priceSignal.tone}`} aria-label="Pricing signal">
          <div>
            <span>Pricing signal</span>
            <strong>{priceSignal.verdict}</strong>
          </div>
          <p>{priceSignal.label}: {priceSignal.rangeLabel}</p>
          <small>{priceSignal.basisLabel}</small>
          <em>{priceSignal.note}</em>
        </section>
        <div className="v2-estimate-meter" aria-label="Estimate composition">
          <div><span style={{ width: `${laborShare}%` }} /></div>
          <small>{laborShare}% labor load - {marginShare}% profit/contingency cushion</small>
        </div>
        <div className="v2-tool-breakdown">
          <div><span>Labor</span><strong>{currency(labor)}</strong></div>
          <div><span>Materials</span><strong>{currency(materials)}</strong></div>
          <div><span>Overhead</span><strong>{currency(overhead)}</strong></div>
          <div><span>Profit markup</span><strong>{currency(margin)}</strong></div>
          <div><span>Contingency</span><strong>{currency(contingency)}</strong></div>
          {roundingAdjustment > 0 ? <div><span>Price rounding</span><strong>{currency(roundingAdjustment)}</strong></div> : null}
        </div>
      </Panel> : null}
      <div className={`v2-tool-action-dock is-estimate is-${step}`} aria-label="Estimate actions">
        <span aria-live="polite" data-save-state={saveState}><strong>{currency(target)}</strong><small>{saveMessage}</small></span>
        {step !== "price" ? <button type="button" onClick={() => setStep(step === "review" ? "customer" : "price")} aria-label="Previous estimate step"><ChevronLeft size={18} /></button> : null}
        <button type="button" onClick={() => void saveDraft()} aria-label="Save estimate" title="Save estimate" disabled={saveState === "saving"}>
          {saveState === "saving" ? <LoaderCircle className="v2-spin" size={18} /> : saveState === "saved" ? <Check size={18} /> : <Save size={18} />}
          <span>{saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : saveState === "error" ? "Try again" : "Save"}</span>
        </button>
        {step === "price" ? <button type="button" className="v2-primary-button" onClick={() => setStep("customer")}><span>Customer</span><ChevronRight size={18} /></button> : null}
        {step === "customer" ? <button type="button" className="v2-primary-button" onClick={openReview}><span>Review</span><ChevronRight size={18} /></button> : null}
        {step === "review" ? <button type="button" className="v2-primary-button" onClick={() => void sendEstimateEmail()} disabled={sending || target <= 0 || !isValidEmail(recipientEmail)}><Mail size={18} /><span>{sending ? "Sending" : delivery?.status === "sent" ? "Send update" : "Send email"}</span></button> : null}
      </div>
    </div>
  );
}
