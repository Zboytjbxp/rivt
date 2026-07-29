import type { ReactNode } from "react";
import {
  documentBrandContactLines,
  documentStyleOptions,
  type DocumentBrand,
  type DocumentStyle,
} from "./document-brand-api";

export function DocumentBrandHeader({
  brand,
  documentLabel,
  documentNumber,
  status,
}: {
  brand: DocumentBrand;
  documentLabel: string;
  documentNumber: string;
  status?: string;
}) {
  const contactLines = documentBrandContactLines(brand);
  const businessName = brand.businessName.trim() || "RIVT member";
  return (
    <header className="v2-document-brand-header">
      <div className={`v2-document-letterhead ${brand.logoUrl ? "has-logo" : "has-text-only"}`}>
        {brand.logoUrl ? <img src={brand.logoUrl} alt={`${businessName} logo`} width="640" height="240" /> : null}
        <div>
          <strong>{businessName}</strong>
          {status ? <span>{status}</span> : null}
          {contactLines.length ? <small>{contactLines.join(" · ")}</small> : null}
        </div>
      </div>
      <aside>
        <span>{documentLabel}</span>
        <strong>{documentNumber}</strong>
      </aside>
    </header>
  );
}

export function DocumentStylePicker({
  label,
  value,
  onChange,
  footer,
}: {
  label: string;
  value: DocumentStyle;
  onChange: (value: DocumentStyle) => void;
  footer?: ReactNode;
}) {
  return (
    <fieldset className="v2-document-style-picker">
      <legend>{label}</legend>
      <div>
        {documentStyleOptions.map((option) => (
          <label key={option.id} className={value === option.id ? "is-active" : ""}>
            <input
              type="radio"
              name={`${label.replace(/\s+/g, "-").toLowerCase()}-style`}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <span className={`v2-document-style-swatch is-${option.id}`} aria-hidden="true"><i /><i /><i /></span>
            <strong>{option.name}</strong>
            <small>{option.description}</small>
          </label>
        ))}
      </div>
      {footer}
    </fieldset>
  );
}
