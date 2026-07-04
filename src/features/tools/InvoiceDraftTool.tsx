import { useEffect, useMemo, useState } from "react";
import { Copy, Download, FileText, Mail, MessageSquare, Plus, Trash2 } from "lucide-react";
import type { Job } from "../../types";
import { Panel } from "../../components/ui";
import type { EstimateInvoiceDraft } from "./EstimateTool";
import { clampNumber, currency, formatQuantity, toCents, centsToDollars } from "./money";
import { getInvoiceLinePriceSignal } from "./priceGuidance";
import { deleteToolRecordByLocalId, fetchToolRecords, upsertToolRecord, type ServerToolRecord } from "./tool-records-api";

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
    { id: "labor", description: "Labor", qty: activeJob?.durationHours ?? 8, rate: activeJob ? Math.max(45, Math.round(activeJob.pay / Math.max(1, activeJob.durationHours) * 0.78)) : 65, kind: "labor" },
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
  estimateDraft = null,
}: {
  activeJob: Job | null;
  estimateDraft?: EstimateInvoiceDraft | null;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState(estimateDraft?.invoiceNumber ?? (activeJob ? `RIVT-${activeJob.id}` : "RIVT-DRAFT"));
  const [billTo, setBillTo] = useState(estimateDraft?.billTo ?? activeJob?.contractor ?? "");
  const [payTo, setPayTo] = useState("");
  const [terms, setTerms] = useState(estimateDraft?.terms ?? "Due on completion");
  const [paymentMethod, setPaymentMethod] = useState(estimateDraft?.paymentMethod ?? "Direct payment");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [taxPct, setTaxPct] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(readInvoiceTemplates);
  const [syncMessage, setSyncMessage] = useState("Saved on this device.");
  const [templateName, setTemplateName] = useState(estimateDraft?.templateName ?? (activeJob ? `${activeJob.title} invoice` : "Standard invoice"));
  const [templateNotice, setTemplateNotice] = useState("");
  const [conversionNotice, setConversionNotice] = useState(estimateDraft?.sourceNote ?? "");
  const [lines, setLines] = useState<InvoiceLine[]>(() => estimateDraft ? invoiceLinesFromEstimate(estimateDraft) : defaultInvoiceLines(activeJob));

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
    activeJob ? `Job: ${activeJob.title}` : "Job: unlinked",
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
  ].join("\n"), [activeJob, billTo, invoiceNumber, lines, paymentMethod, payTo, subtotal, tax, terms, total]);
  const emailHref = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(`Invoice ${invoiceNumber}`)}&body=${encodeURIComponent(invoiceText)}`;
  const smsHref = `sms:${encodeURIComponent(recipientPhone)}?body=${encodeURIComponent(`RIVT invoice ${invoiceNumber}: ${currency(total)} due. ${terms}. ${paymentMethod}.`)}`;

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
    setInvoiceNumber("RIVT-DRAFT");
    setBillTo("");
    setPayTo("");
    setTerms("Due on completion");
    setPaymentMethod("Direct payment");
    setRecipientEmail("");
    setRecipientPhone("");
    setTaxPct(0);
    setTemplateName("Standard invoice");
    setLines(defaultInvoiceLines(null));
    setConversionNotice("");
    setTemplateNotice("Blank invoice started.");
  }

  async function copyInvoice() {
    try {
      await navigator.clipboard.writeText(invoiceText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadInvoice() {
    const blob = new Blob([invoiceText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoiceNumber.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }

  function printInvoice() {
    window.print();
  }

  return (
    <div className="v2-tool-workbench v2-invoice-workbench">
      <Panel className="v2-tool-panel v2-invoice-builder-panel" eyebrow="Invoice draft" title="Build an invoice">
        <section className="v2-invoice-topline" aria-label="Invoice summary">
          <div>
            <span>Total due</span>
            <strong>{currency(total)}</strong>
            <small>{invoiceNumber || "RIVT-DRAFT"} / {terms}</small>
          </div>
          <div className="v2-invoice-topline-actions">
            <button type="button" className="v2-primary-button" onClick={copyInvoice}><Copy size={15} />{copied ? "Copied" : "Copy"}</button>
            <button type="button" onClick={printInvoice}><FileText size={15} />Print</button>
          </div>
        </section>

        {conversionNotice ? (
          <div className="v2-converted-estimate-note" role="status">
            <p>{conversionNotice}</p>
            <span>
              <button type="button" onClick={() => setConversionNotice("")}>Dismiss</button>
              <button type="button" onClick={startBlankInvoice}>Start blank invoice</button>
            </span>
          </div>
        ) : null}
        <section className="v2-invoice-template-bar" aria-label="Invoice templates">
          <label>Template name<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Standard labor invoice" /></label>
          <button type="button" className="v2-primary-button" onClick={saveTemplate}><FileText size={14} />Save template</button>
          <small>{syncMessage}</small>
        </section>
        {templateNotice ? <p className="v2-record-notice" role="status">{templateNotice}</p> : null}
        {templates.length ? (
          <div className="v2-invoice-template-list" aria-label="Saved invoice templates">
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
        <section className="v2-invoice-builder-section" aria-label="Invoice details">
          <header className="v2-invoice-section-title">
            <h3>Details</h3>
            <span>{activeJob?.title ?? "Standalone invoice"}</span>
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
        </section>
        <div className="v2-invoice-lines" aria-label="Invoice line items">
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
        </div>
      </Panel>

      <aside className="v2-invoice-side-stack">
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
          <p className="v2-tool-note">Email and text open drafts from your own apps. RIVT does not send on your behalf.</p>
          <div className="v2-invoice-delivery" aria-label="Invoice draft delivery">
            <a href={recipientEmail ? emailHref : undefined} aria-disabled={!recipientEmail} onClick={(event) => { if (!recipientEmail) event.preventDefault(); }}>
              <Mail size={15} />
              Email draft
            </a>
            <a href={recipientPhone ? smsHref : undefined} aria-disabled={!recipientPhone} onClick={(event) => { if (!recipientPhone) event.preventDefault(); }}>
              <MessageSquare size={15} />
              Text draft
            </a>
          </div>
          <div className="v2-tool-action-row">
            <button type="button" className="v2-primary-button" onClick={copyInvoice}><Copy size={15} />{copied ? "Copied" : "Copy invoice"}</button>
            <button type="button" onClick={downloadInvoice}><Download size={15} />{downloaded ? "Downloaded" : "Download TXT"}</button>
            <button type="button" onClick={printInvoice}><FileText size={15} />Print</button>
          </div>
        </Panel>

        <Panel className="v2-tool-panel v2-invoice-preview-panel" eyebrow="Preview" title="Printable invoice">
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
              <div><span>Job</span><strong>{activeJob?.title ?? "Unlinked work"}</strong></div>
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
        </Panel>
      </aside>
    </div>
  );
}

