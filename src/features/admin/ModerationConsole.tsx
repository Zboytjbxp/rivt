import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CheckCircle2,
  EyeOff,
  Flag,
  LifeBuoy,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { EmptyState, PageHeader, Panel, SkeletonCard, StatusPill } from "../../components/ui";
import {
  fetchShopTalkModerationReports,
  resolveShopTalkModerationReport,
  type ModerationAction,
  type ModerationReport,
  type ModerationReportStatus,
  type ModerationTargetType,
} from "./admin-moderation-api";
import {
  approveAccountTypeChange,
  fetchAdminSupportCases,
  updateSupportCaseStatus,
  type SupportCase,
} from "./admin-support-api";
import "./moderation-console.css";

const statusFilters: Array<{ value: ModerationReportStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "reviewing", label: "Reviewing" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

const actionLabels: Record<ModerationAction, string> = {
  dismiss: "Dismiss report",
  hide: "Hide target",
  lock: "Lock thread",
  archive_community: "Archive community",
  restore: "Restore target",
};

const actionDescriptions: Record<ModerationAction, string> = {
  dismiss: "No visible content change. The report is closed with an audit trail.",
  hide: "Removes the reported content from normal Shop Talk surfaces.",
  lock: "Keeps the content visible but prevents more replies.",
  archive_community: "Closes the community and removes it from normal discovery.",
  restore: "Returns previously hidden, locked, or archived content to normal visibility.",
};

const reasonLabels: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  unsafe_advice: "Unsafe advice",
  misinformation: "Misinformation",
  privacy: "Privacy/contact info",
  duplicate: "Duplicate/off-topic",
  other: "Other",
};

function relativeTime(value: string | null) {
  if (!value) return "Never";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function titleForTarget(report: ModerationReport) {
  const snapshot = report.targetSnapshot;
  if (report.targetType === "community") return snapshot.name ?? "Community";
  if (report.targetType === "post") return snapshot.title ?? "Shop Talk post";
  return snapshot.postTitle ?? "Shop Talk answer";
}

function bodyForTarget(report: ModerationReport) {
  const snapshot = report.targetSnapshot;
  if (report.targetType === "community") return snapshot.description ?? "No community description was captured.";
  return snapshot.bodyExcerpt ?? "No text excerpt was captured.";
}

function availableActions(targetType: ModerationTargetType): ModerationAction[] {
  if (targetType === "community") return ["dismiss", "hide", "archive_community", "restore"];
  if (targetType === "post") return ["dismiss", "hide", "lock", "restore"];
  return ["dismiss", "hide", "restore"];
}

function defaultActionReason(report: ModerationReport, action: ModerationAction) {
  const target = titleForTarget(report);
  const reportReason = reasonLabels[report.reasonCode] ?? report.reasonCode;
  if (action === "dismiss") return `Reviewed ${target}. Dismissed because no policy action was needed for ${reportReason.toLowerCase()}.`;
  if (action === "restore") return `Reviewed ${target}. Restored because the content is acceptable for Shop Talk.`;
  if (action === "archive_community") return `Archived ${target} after a ${reportReason.toLowerCase()} report.`;
  if (action === "lock") return `Locked ${target} after a ${reportReason.toLowerCase()} report to prevent further replies.`;
  return `Hidden ${target} after a ${reportReason.toLowerCase()} report.`;
}

function statusTone(status: ModerationReport["status"]) {
  if (status === "open" || status === "reviewing") return "warning" as const;
  if (status === "actioned") return "success" as const;
  return "neutral" as const;
}

function roleLabel(role: string | null | undefined) {
  if (role === "contractor") return "Contractor";
  if (role === "tradesperson") return "Tradesperson";
  if (role === "pending") return "Pending";
  return "Unknown";
}

function requestedRoleFromCase(supportCase: SupportCase) {
  const text = `${supportCase.title} ${supportCase.description}`.toLowerCase();
  if (text.includes("to contractor") || text.includes("contractor access")) return "contractor" as const;
  if (text.includes("to tradesperson") || text.includes("tradesperson access")) return "tradesperson" as const;
  return supportCase.openedBy?.primaryRole === "contractor" ? "tradesperson" as const : "contractor" as const;
}

function supportStatusTone(status: SupportCase["status"]) {
  if (status === "open" || status === "reviewing") return "warning" as const;
  if (status === "resolved") return "success" as const;
  return "neutral" as const;
}

function SupportCasesPanel({
  onActivity,
}: {
  onActivity?: (title: string, detail: string, kind?: "info" | "success" | "warning" | "error") => void;
}) {
  const [supportCases, setSupportCases] = useState<SupportCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const selectedCaseIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState<"contractor" | "tradesperson">("contractor");
  const [organizationName, setOrganizationName] = useState("");
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"approve" | "close" | null>(null);

  const selectedCase = useMemo(
    () => supportCases.find((supportCase) => supportCase.id === selectedCaseId) ?? supportCases[0] ?? null,
    [supportCases, selectedCaseId],
  );

  function applySupportDecisionDefaults(supportCase: SupportCase | null) {
    if (!supportCase) return;
    const nextTargetRole = requestedRoleFromCase(supportCase);
    setTargetRole(nextTargetRole);
    setOrganizationName("");
    setReason(`Reviewed support case ${supportCase.id}. Approved account type change to ${roleLabel(nextTargetRole)}.`);
    setActionError(null);
  }

  const applyLoadedSupportCases = useCallback((cases: SupportCase[]) => {
    const nextSelected = (
      selectedCaseIdRef.current
        ? cases.find((supportCase) => supportCase.id === selectedCaseIdRef.current)
        : null
    ) ?? cases[0] ?? null;
    setSupportCases(cases);
    selectedCaseIdRef.current = nextSelected?.id ?? null;
    setSelectedCaseId(nextSelected?.id ?? null);
    if (nextSelected) {
      const nextTargetRole = requestedRoleFromCase(nextSelected);
      setTargetRole(nextTargetRole);
      setOrganizationName("");
      setReason(`Reviewed support case ${nextSelected.id}. Approved account type change to ${roleLabel(nextTargetRole)}.`);
      setActionError(null);
    }
  }, []);

  const loadSupportCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cases = await fetchAdminSupportCases();
      applyLoadedSupportCases(cases);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load support cases.");
    } finally {
      setLoading(false);
    }
  }, [applyLoadedSupportCases]);

  useEffect(() => {
    let active = true;
    async function hydrateSupportCases() {
      try {
        const cases = await fetchAdminSupportCases();
        if (!active) return;
        applyLoadedSupportCases(cases);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load support cases.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void hydrateSupportCases();
    return () => {
      active = false;
    };
  }, [applyLoadedSupportCases]);

  function selectSupportCase(supportCase: SupportCase) {
    selectedCaseIdRef.current = supportCase.id;
    setSelectedCaseId(supportCase.id);
    applySupportDecisionDefaults(supportCase);
  }

  async function approveSelectedCase() {
    if (!selectedCase) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setActionError("Add a short support note before approving.");
      return;
    }
    setSubmitting("approve");
    setActionError(null);
    try {
      const updated = await approveAccountTypeChange(selectedCase.id, {
        targetRole,
        organizationName: organizationName.trim() || undefined,
        reasonCode: "account_type_change",
        reason: trimmedReason,
      });
      setSupportCases((current) => current.map((supportCase) => supportCase.id === updated.id ? updated : supportCase));
      onActivity?.("Account type updated", `${selectedCase.openedBy?.email || selectedCase.openedByAccountId} is now ${roleLabel(targetRole)}.`, "success");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not approve account type change.";
      setActionError(message);
      onActivity?.("Account type update failed", message, "error");
    } finally {
      setSubmitting(null);
    }
  }

  async function closeSelectedCase() {
    if (!selectedCase) return;
    const trimmedReason = reason.trim() || `Closed support case ${selectedCase.id} without changing account type.`;
    setSubmitting("close");
    setActionError(null);
    try {
      const updated = await updateSupportCaseStatus(selectedCase.id, {
        status: "closed",
        note: "Support closed this request without changing account type.",
        reasonCode: "account_type_no_change",
        reason: trimmedReason,
      });
      setSupportCases((current) => current.map((supportCase) => supportCase.id === updated.id ? updated : supportCase));
      onActivity?.("Support case closed", "The account type request was closed without changing access.", "info");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not close support case.";
      setActionError(message);
      onActivity?.("Support case close failed", message, "error");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <section className="moderation-layout support-case-layout">
      <Panel className="moderation-queue-panel">
        <div className="moderation-summary-line">
          <span><strong>{supportCases.length}</strong> open or reviewing support case{supportCases.length === 1 ? "" : "s"}</span>
        </div>
        {loading ? (
          <div className="moderation-skeleton-list">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <EmptyState
            title="Support cases could not be loaded"
            description={error}
            action={(
              <button type="button" className="v2-secondary-button" onClick={() => void loadSupportCases()}>
                Try again
              </button>
            )}
          />
        ) : supportCases.length ? (
          <div className="moderation-report-list">
            {supportCases.map((supportCase) => (
              <button
                key={supportCase.id}
                type="button"
                className={supportCase.id === selectedCase?.id ? "moderation-report-row is-active" : "moderation-report-row"}
                onClick={() => selectSupportCase(supportCase)}
              >
                <span className="moderation-report-row-top">
                  <strong>{supportCase.title}</strong>
                  <StatusPill tone={supportStatusTone(supportCase.status)}>{supportCase.status}</StatusPill>
                </span>
                <span>{supportCase.openedBy?.email || supportCase.openedByAccountId}</span>
                <small>{supportCase.category} · {relativeTime(supportCase.createdAt)}</small>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState title="No support cases waiting" description="Account type requests and support notes will show up here." />
        )}
      </Panel>

      <Panel className="moderation-review-panel">
        {selectedCase ? (
          <div className="moderation-review support-case-review">
            <div className="moderation-review-heading">
              <div>
                <span>Support case</span>
                <h2>{selectedCase.title}</h2>
              </div>
              <StatusPill tone={supportStatusTone(selectedCase.status)}>{selectedCase.status}</StatusPill>
            </div>
            <dl className="moderation-context-grid">
              <div><dt>User</dt><dd>{selectedCase.openedBy?.displayName || selectedCase.openedBy?.email || selectedCase.openedByAccountId}</dd></div>
              <div><dt>Email</dt><dd>{selectedCase.openedBy?.email || "Unknown"}</dd></div>
              <div><dt>Current role</dt><dd>{roleLabel(selectedCase.openedBy?.primaryRole)}</dd></div>
              <div><dt>Opened</dt><dd>{relativeTime(selectedCase.createdAt)}</dd></div>
            </dl>
            <article className="moderation-snapshot">
              <strong>Request</strong>
              <p>{selectedCase.description}</p>
            </article>
            <div className="support-case-decision">
              <label>
                <span>Target account type</span>
                <select value={targetRole} onChange={(event) => setTargetRole(event.target.value as "contractor" | "tradesperson")}>
                  <option value="contractor">Contractor</option>
                  <option value="tradesperson">Tradesperson</option>
                </select>
              </label>
              {targetRole === "contractor" ? (
                <label>
                  <span>Business or crew name</span>
                  <input
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    placeholder="Required if they do not already own an organization"
                  />
                </label>
              ) : null}
              <label className="is-wide">
                <span>Support note</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} />
              </label>
            </div>
            {actionError ? <div className="moderation-error">{actionError}</div> : null}
            <div className="moderation-submit-row">
              <button
                type="button"
                className="v2-secondary-button"
                onClick={() => void closeSelectedCase()}
                disabled={Boolean(submitting) || selectedCase.status === "closed" || selectedCase.status === "resolved"}
              >
                {submitting === "close" ? "Closing..." : "Close without change"}
              </button>
              <button
                type="button"
                className="v2-primary-button"
                onClick={() => void approveSelectedCase()}
                disabled={Boolean(submitting) || selectedCase.status === "closed" || selectedCase.status === "resolved"}
              >
                {submitting === "approve" ? "Approving..." : `Approve ${roleLabel(targetRole)}`}
              </button>
            </div>
          </div>
        ) : (
          <EmptyState title="Select a support case" description="Choose a request to review account details and apply a support action." />
        )}
      </Panel>
    </section>
  );
}

export function ModerationConsole({
  adminRoles,
  onActivity,
}: {
  adminRoles: string[];
  onActivity?: (title: string, detail: string, kind?: "info" | "success" | "warning" | "error") => void;
}) {
  const [status, setStatus] = useState<ModerationReportStatus>("open");
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const selectedReportIdRef = useRef<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<ModerationAction>("dismiss");
  const [actionReason, setActionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [adminSection, setAdminSection] = useState<"reports" | "support">("reports");

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId],
  );

  const applyLoadedReports = useCallback((nextReports: ModerationReport[]) => {
    const nextSelected = (
      selectedReportIdRef.current
        ? nextReports.find((report) => report.id === selectedReportIdRef.current)
        : null
    ) ?? nextReports[0] ?? null;
    setReports(nextReports);
    selectedReportIdRef.current = nextSelected?.id ?? null;
    setSelectedReportId(nextSelected?.id ?? null);
    if (nextSelected) {
      const nextAction = availableActions(nextSelected.targetType)[0];
      setSelectedAction(nextAction);
      setActionReason(defaultActionReason(nextSelected, nextAction));
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextReports = await fetchShopTalkModerationReports(status);
      applyLoadedReports(nextReports);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load the moderation queue.");
    } finally {
      setLoading(false);
    }
  }, [applyLoadedReports, status]);

  useEffect(() => {
    let active = true;
    async function hydrateReports() {
      try {
        const nextReports = await fetchShopTalkModerationReports(status);
        if (!active) return;
        applyLoadedReports(nextReports);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load the moderation queue.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void hydrateReports();
    return () => {
      active = false;
    };
  }, [applyLoadedReports, status]);

  function selectReport(report: ModerationReport) {
    const nextAction = availableActions(report.targetType)[0];
    selectedReportIdRef.current = report.id;
    setSelectedReportId(report.id);
    setSelectedAction(nextAction);
    setActionReason(defaultActionReason(report, nextAction));
    setActionError(null);
  }

  function selectAction(action: ModerationAction) {
    setSelectedAction(action);
    if (selectedReport) {
      setActionReason(defaultActionReason(selectedReport, action));
    }
    setActionError(null);
  }

  async function submitAction() {
    if (!selectedReport) return;
    const reason = actionReason.trim();
    if (!reason) {
      setActionError("Add a short moderation note before applying this action.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await resolveShopTalkModerationReport(selectedReport.id, {
        action: selectedAction,
        reasonCode: selectedReport.reasonCode,
        reason,
      });
      setReports((current) => current.map((report) => report.id === updated.id ? updated : report));
      onActivity?.("Moderation action applied", `${actionLabels[selectedAction]} was recorded for ${titleForTarget(updated)}.`, "success");
      if (status === "open" || status === "reviewing") {
        setReports((current) => current.filter((report) => report.id !== updated.id));
        selectedReportIdRef.current = null;
        setSelectedReportId((current) => current === updated.id ? null : current);
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not apply that moderation action.";
      setActionError(message);
      onActivity?.("Moderation action failed", message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const metrics = useMemo(() => {
    const open = reports.filter((report) => report.status === "open").length;
    const safety = reports.filter((report) => report.reasonCode === "unsafe_advice" || report.reasonCode === "misinformation").length;
    const community = reports.filter((report) => report.targetType === "community").length;
    const oldest = reports.reduce<string | null>((oldestValue, report) => {
      if (!oldestValue) return report.createdAt;
      return new Date(report.createdAt).getTime() < new Date(oldestValue).getTime() ? report.createdAt : oldestValue;
    }, null);
    return { open, safety, community, oldest };
  }, [reports]);

  const roleCopy = adminRoles.length ? adminRoles.join(", ") : "No staff role detected";

  return (
    <main className="moderation-console">
      <PageHeader
        className="moderation-page-header"
        title="Admin"
        actions={adminSection === "reports" ? (
          <button type="button" className="v2-secondary-button" onClick={() => void loadReports()} disabled={loading}>
            <RefreshCw size={16} />
            Refresh
          </button>
        ) : null}
      />

      <div className="moderation-role-strip">
        <ShieldCheck size={16} />
        <span>Staff access: {roleCopy}</span>
      </div>

      <section className="admin-section-tabs" aria-label="Admin section">
        <button
          type="button"
          className={adminSection === "reports" ? "is-active" : ""}
          aria-pressed={adminSection === "reports"}
          onClick={() => setAdminSection("reports")}
        >
          <Flag size={16} />
          Shop Talk moderation
        </button>
        <button
          type="button"
          className={adminSection === "support" ? "is-active" : ""}
          aria-pressed={adminSection === "support"}
          onClick={() => setAdminSection("support")}
        >
          <LifeBuoy size={16} />
          Support cases
        </button>
      </section>

      {adminSection === "support" ? (
        <SupportCasesPanel onActivity={onActivity} />
      ) : (
        <>
      <section className="moderation-filter-row" aria-label="Moderation report status">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={filter.value === status ? "is-active" : ""}
            aria-pressed={filter.value === status}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </section>

      <section className="moderation-summary-line" aria-label="Moderation summary">
        <span><strong>{metrics.open}</strong> open</span>
        <span><strong>{metrics.safety}</strong> safety</span>
        <span><strong>{metrics.community}</strong> community</span>
        <span><strong>{relativeTime(metrics.oldest)}</strong> oldest</span>
      </section>

      {error ? (
        <EmptyState
          icon={<ShieldAlert size={22} />}
          title="Moderation queue could not load"
          description={error}
          action={(
            <button type="button" className="v2-secondary-button" onClick={() => void loadReports()}>
              Try again
            </button>
          )}
        />
      ) : (
        <div className="moderation-layout">
          <Panel
            className="moderation-queue-panel"
            title="Report queue"
          >
            {loading ? (
              <div className="moderation-skeleton-list">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : reports.length === 0 ? (
              <EmptyState
                compact
                icon={<ShieldCheck size={20} />}
                title="No reports in this queue"
                description="Reported Shop Talk activity will land here."
              />
            ) : (
              <div className="moderation-report-list">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    className={selectedReport?.id === report.id ? "moderation-report-row is-active" : "moderation-report-row"}
                    onClick={() => selectReport(report)}
                  >
                    <span className="moderation-report-row-top">
                      <strong>{titleForTarget(report)}</strong>
                      <StatusPill tone={statusTone(report.status)}>{report.status}</StatusPill>
                    </span>
                    <span>{report.targetType} · {reasonLabels[report.reasonCode] ?? report.reasonCode}</span>
                    <small>{report.reporterName || "Unknown reporter"} · {relativeTime(report.createdAt)}</small>
                  </button>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            className="moderation-review-panel"
            title="Review"
          >
            {selectedReport ? (
              <div className="moderation-review">
                <div className="moderation-review-heading">
                  <div>
                    <span>{selectedReport.targetType}</span>
                    <h2>{titleForTarget(selectedReport)}</h2>
                  </div>
                  <StatusPill tone={statusTone(selectedReport.status)}>{selectedReport.status}</StatusPill>
                </div>

                <dl className="moderation-context-grid">
                  <div>
                    <dt>Reason</dt>
                    <dd>{reasonLabels[selectedReport.reasonCode] ?? selectedReport.reasonCode}</dd>
                  </div>
                  <div>
                    <dt>Reporter</dt>
                    <dd>{selectedReport.reporterName || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Community</dt>
                    <dd>{selectedReport.targetSnapshot.communityName ?? selectedReport.targetSnapshot.name ?? "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Reported</dt>
                    <dd>{relativeTime(selectedReport.createdAt)}</dd>
                  </div>
                </dl>

                <article className="moderation-snapshot">
                  <strong>Reported content</strong>
                  <p>{bodyForTarget(selectedReport)}</p>
                  {selectedReport.note ? (
                    <blockquote>{selectedReport.note}</blockquote>
                  ) : null}
                </article>

                <div className="moderation-action-grid" aria-label="Moderation actions">
                  {availableActions(selectedReport.targetType).map((action) => (
                    <button
                      key={action}
                      type="button"
                      className={selectedAction === action ? "is-active" : ""}
                      aria-pressed={selectedAction === action}
                      onClick={() => selectAction(action)}
                    >
                      {action === "dismiss" ? <CheckCircle2 size={16} /> : null}
                      {action === "hide" ? <EyeOff size={16} /> : null}
                      {action === "lock" ? <Lock size={16} /> : null}
                      {action === "archive_community" ? <Archive size={16} /> : null}
                      {action === "restore" ? <RotateCcw size={16} /> : null}
                      <span>
                        <strong>{actionLabels[action]}</strong>
                        <small>{actionDescriptions[action]}</small>
                      </span>
                    </button>
                  ))}
                </div>

                <label className="moderation-note-field">
                  <span>Support note</span>
                  <textarea
                    value={actionReason}
                    rows={4}
                    maxLength={2000}
                    onChange={(event) => setActionReason(event.target.value)}
                  />
                </label>

                {actionError ? <div className="moderation-error">{actionError}</div> : null}

                <button type="button" className="v2-primary-button moderation-submit" onClick={() => void submitAction()} disabled={submitting}>
                  {submitting ? "Applying..." : actionLabels[selectedAction]}
                </button>
              </div>
            ) : (
              <EmptyState
                compact
                icon={<Flag size={20} />}
                title="Select a report"
                description="Choose a queue item to review it."
              />
            )}
          </Panel>
        </div>
      )}
        </>
      )}
    </main>
  );
}

export default ModerationConsole;
