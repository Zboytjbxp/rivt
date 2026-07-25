import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import { apiPath, fetchWithTimeout } from "../../lib/api";
import "./payment-complete.css";

type PaymentStatus =
  | "created"
  | "open"
  | "processing"
  | "paid"
  | "failed"
  | "expired"
  | "disputed"
  | "partially_refunded"
  | "refunded";

interface PublicPayment {
  invoiceNumber: string;
  payTo: string;
  amountCents: number;
  refundedCents: number;
  currency: string;
  status: PaymentStatus;
  updatedAt: string | null;
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function statusContent(status: PaymentStatus) {
  if (status === "paid") {
    return {
      Icon: CheckCircle2,
      tone: "success",
      title: "Bank payment settled",
      body: "Stripe confirmed the payment. The contractor's invoice record has been updated.",
    };
  }
  if (status === "processing") {
    return {
      Icon: Clock3,
      tone: "processing",
      title: "Bank payment processing",
      body: "ACH payments can take several business days. This invoice is not marked paid until Stripe confirms settlement.",
    };
  }
  if (status === "open" || status === "created") {
    return {
      Icon: Clock3,
      tone: "processing",
      title: "Payment not submitted",
      body: "The bank-payment page was opened, but Stripe has not confirmed a submitted payment.",
    };
  }
  if (status === "partially_refunded") {
    return {
      Icon: AlertTriangle,
      tone: "warning",
      title: "Payment partially refunded",
      body: "Part of this payment was refunded. Contact the contractor if you need details.",
    };
  }
  if (status === "refunded") {
    return {
      Icon: AlertTriangle,
      tone: "warning",
      title: "Payment refunded",
      body: "Stripe reports that this payment was refunded.",
    };
  }
  if (status === "disputed") {
    return {
      Icon: AlertTriangle,
      tone: "danger",
      title: "Payment disputed",
      body: "Stripe reports a dispute on this bank payment. The invoice is not treated as settled.",
    };
  }
  return {
    Icon: XCircle,
    tone: "danger",
    title: status === "expired" ? "Payment link expired" : "Bank payment failed",
    body: status === "expired"
      ? "Ask the contractor for a new bank-payment link."
      : "Stripe did not complete the payment. No settled payment was recorded in RIVT.",
  };
}

async function loadPublicPayment(sessionId: string) {
  const response = await fetchWithTimeout(apiPath(`/api/v1/invoice-payments/${encodeURIComponent(sessionId)}`));
  const body = await response.json().catch(() => ({})) as {
    data?: { payment?: PublicPayment };
    error?: { message?: string };
  };
  if (!response.ok || !body.data?.payment) {
    throw new Error(body.error?.message || "RIVT could not confirm this payment status.");
  }
  return body.data.payment;
}

export function PaymentCompleteView() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id")?.trim() ?? "";
  const cancelled = params.get("cancelled") === "1";
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      setPayment(await loadPublicPayment(sessionId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "RIVT could not confirm this payment status.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void loadPublicPayment(sessionId)
      .then((result) => {
        if (active) setPayment(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "RIVT could not confirm this payment status.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  const content = payment ? statusContent(payment.status) : null;
  const StatusIcon = content?.Icon;

  return (
    <main className="rivt-v2 payment-complete-page">
      <header className="payment-complete-brand">
        <a href="/" aria-label="RIVT home">RIVT</a>
        <span>Secure bank payment</span>
      </header>
      <section className={`payment-complete-card${content ? ` is-${content.tone}` : ""}`}>
        {loading ? (
          <>
            <RefreshCw className="is-spinning" aria-hidden="true" />
            <h1>Checking payment status</h1>
            <p>RIVT is asking Stripe for the latest status.</p>
          </>
        ) : payment && content && StatusIcon ? (
          <>
            <StatusIcon aria-hidden="true" />
            <p className="payment-complete-eyebrow">Invoice {payment.invoiceNumber}</p>
            <h1>{content.title}</h1>
            <strong className="payment-complete-amount">{money(payment.amountCents - payment.refundedCents)}</strong>
            <p>{content.body}</p>
            <dl>
              <div><dt>Paying</dt><dd>{payment.payTo}</dd></div>
              <div><dt>Status</dt><dd>{payment.status.replaceAll("_", " ")}</dd></div>
            </dl>
            {payment.status !== "paid" ? (
              <button type="button" onClick={() => void refresh()}><RefreshCw size={16} />Refresh status</button>
            ) : null}
          </>
        ) : (
          <>
            <XCircle aria-hidden="true" />
            <h1>{cancelled ? "Payment not submitted" : "Payment status unavailable"}</h1>
            <p>{error || (cancelled
              ? "You left Stripe before submitting a bank payment. No settled payment was recorded."
              : "This payment link is missing or no longer available.")}</p>
            {sessionId ? <button type="button" onClick={() => void refresh()}><RefreshCw size={16} />Try again</button> : null}
          </>
        )}
      </section>
      <footer>
        <p>Payment details are handled by Stripe. RIVT does not hold job funds.</p>
      </footer>
    </main>
  );
}
