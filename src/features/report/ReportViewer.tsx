import React, { useState } from "react";
import { decodeReport, type ReportData } from "./reportUtils";
import "./ReportViewer.css";

interface ReportViewerProps {
  encoded: string;
}

export function ReportViewer({ encoded }: ReportViewerProps) {
  const report: ReportData | null = decodeReport(encoded);
  const [signed, setSigned] = useState(false);

  if (!report) {
    return (
      <div className="rv-error">
        <h1>Report not found</h1>
        <p>This link may be invalid or expired.</p>
      </div>
    );
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="rv-page">
      <header className="rv-header">
        <div className="rv-logo">RIVT</div>
        <span className="rv-label">Job Report</span>
      </header>

      <main className="rv-main">
        <section className="rv-hero">
          <h1 className="rv-job-title">{report.jobTitle}</h1>
          <p className="rv-contractor">{report.contractorName} · {report.trade}</p>
          {report.jobLocation && <p className="rv-location">{report.jobLocation}</p>}
        </section>

        <section className="rv-stats">
          <div className="rv-stat">
            <span>Total</span>
            <strong>{fmt(report.totalAmount)}</strong>
          </div>
          <div className="rv-stat">
            <span>Hours</span>
            <strong>{report.hoursWorked}h</strong>
          </div>
          <div className="rv-stat">
            <span>Start</span>
            <strong>{report.startDate}</strong>
          </div>
          <div className="rv-stat">
            <span>Completed</span>
            <strong>{report.endDate}</strong>
          </div>
        </section>

        {report.materials.length > 0 && (
          <section className="rv-section">
            <h2>Materials &amp; expenses</h2>
            <ul className="rv-materials">
              {report.materials.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </section>
        )}

        {report.notes && (
          <section className="rv-section">
            <h2>Notes</h2>
            <p className="rv-notes">{report.notes}</p>
          </section>
        )}

        <section className="rv-signoff">
          {signed ? (
            <div className="rv-signed">
              <span>&#10003;</span>
              <strong>Work confirmed</strong>
              <p>Signed {new Date().toLocaleDateString()}</p>
            </div>
          ) : (
            <>
              <p>Review the work above and confirm completion.</p>
              <button type="button" className="rv-sign-btn" onClick={() => setSigned(true)}>
                Confirm &amp; sign off
              </button>
            </>
          )}
        </section>
      </main>

      <footer className="rv-footer">
        <p>Generated {new Date(report.generatedAt).toLocaleDateString()} via RIVT</p>
        <a href="/">Get RIVT free &#8594;</a>
      </footer>
    </div>
  );
}
