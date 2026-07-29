import { Mail, MessageSquare, Send, X } from "lucide-react";
import { DialogBackdrop, DialogSurface } from "../../components/ui";

export function DocumentSendSheet({
  open,
  title,
  email,
  phone,
  smsHref,
  busy,
  onClose,
  onSendEmail,
}: {
  open: boolean;
  title: string;
  email: string;
  phone: string;
  smsHref: string;
  busy: boolean;
  onClose: () => void;
  onSendEmail: () => Promise<boolean>;
}) {
  if (!open) return null;
  const canEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canText = Boolean(phone.trim());

  async function emailDocument() {
    if (!canEmail) return;
    if (await onSendEmail()) onClose();
  }

  async function emailThenText() {
    if (!canEmail || !canText) return;
    if (await onSendEmail()) {
      onClose();
      window.location.href = smsHref;
    }
  }

  return (
    <DialogBackdrop className="v2-document-send-backdrop" onClose={onClose}>
      <DialogSurface className="v2-document-send-sheet" labelledBy="document-send-title" onClose={onClose}>
        <header>
          <div>
            <strong id="document-send-title">Send {title}</strong>
            <small>Choose how to hand this customer copy off.</small>
          </div>
          <button type="button" aria-label="Close send options" onClick={onClose}><X size={19} /></button>
        </header>
        <div className="v2-document-send-options">
          <button type="button" disabled={!canEmail || busy} onClick={() => void emailDocument()}>
            <Mail size={20} />
            <span>
              <strong>Email</strong>
              <small>{canEmail ? email : "Add a customer email first"}</small>
            </span>
          </button>
          <a
            href={canText ? smsHref : undefined}
            aria-disabled={!canText}
            onClick={(event) => {
              if (!canText) event.preventDefault();
              else onClose();
            }}
          >
            <MessageSquare size={20} />
            <span>
              <strong>Text</strong>
              <small>{canText ? `Open a draft to ${phone}` : "Add a customer phone first"}</small>
            </span>
          </a>
          <button type="button" disabled={!canEmail || !canText || busy} onClick={() => void emailThenText()}>
            <Send size={20} />
            <span>
              <strong>Email, then text</strong>
              <small>RIVT sends the email, then opens your device's text draft.</small>
            </span>
          </button>
        </div>
        <p>RIVT records email delivery attempts. A text is not sent until you send it from your device.</p>
      </DialogSurface>
    </DialogBackdrop>
  );
}
