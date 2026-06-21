import type { CSSProperties, ReactNode } from "react";
import "./ui.css";

type SurfaceElement = "article" | "aside" | "section";
type Tone = "neutral" | "success" | "warning" | "danger" | "info";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("rivt-page-header", className)}>
      <div className="rivt-page-header-copy">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="rivt-page-header-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  as = "section",
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  as?: SurfaceElement;
  eyebrow?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const Tag = as;

  return (
    <Tag className={cx("rivt-panel", className)}>
      {title || eyebrow || description || action ? (
        <header className="rivt-panel-header">
          <div>
            {eyebrow ? <span>{eyebrow}</span> : null}
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action ? <div className="rivt-panel-action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </Tag>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <article className={cx("rivt-empty-state", compact && "is-compact", className)}>
      {icon ? <span className="rivt-empty-icon">{icon}</span> : null}
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {action ? <div className="rivt-empty-action">{action}</div> : null}
    </article>
  );
}

export function MetricTile({
  value,
  label,
  detail,
  icon,
  className,
}: {
  value: ReactNode;
  label: string;
  detail?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cx("rivt-metric-tile", icon ? "has-icon" : false, className)}>
      {icon ? <span className="rivt-metric-icon">{icon}</span> : null}
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        {detail ? <small>{detail}</small> : null}
      </div>
    </article>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx("rivt-status-pill", `tone-${tone}`, className)}>{children}</span>;
}

const avatarColors = ["#ef5f1a", "#1f8a70", "#b68a2c", "#456075", "#8b5c43", "#7a6f46"];

function colorForName(name: string) {
  const value = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return avatarColors[value % avatarColors.length];
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "R";
  const style = { "--avatar-accent": colorForName(name || initial) } as CSSProperties;

  return (
    <span className={cx("rivt-avatar", `size-${size}`, className)} style={style}>
      {src ? <img src={src} alt={`${name} profile`} /> : <span aria-hidden="true">{initial}</span>}
    </span>
  );
}
