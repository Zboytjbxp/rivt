import type { ComponentType, SVGProps } from "react";
import { CameraIcon } from "@phosphor-icons/react/dist/csr/Camera";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/csr/ClipboardText";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";

export interface ToolIdentityIconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  size?: number | string;
}

export type ToolIdentityIcon = ComponentType<ToolIdentityIconProps>;

export function CameraToolIcon({ size = 28, ...props }: ToolIdentityIconProps) {
  return <CameraIcon size={size} weight="duotone" {...props} />;
}

export function EstimateToolIcon({ size = 28, ...props }: ToolIdentityIconProps) {
  return <FileTextIcon size={size} weight="duotone" {...props} />;
}

export function InvoiceToolIcon({ size = 28, ...props }: ToolIdentityIconProps) {
  return <ReceiptIcon size={size} weight="duotone" {...props} />;
}

export function JobsiteToolIcon({ size = 28, ...props }: ToolIdentityIconProps) {
  return <ClipboardTextIcon size={size} weight="duotone" {...props} />;
}

export function MaterialsToolIcon({ size = 28, ...props }: ToolIdentityIconProps) {
  return <PackageIcon size={size} weight="duotone" {...props} />;
}

export function HeavySixteenthToolIcon({
  size = 28,
  ...props
}: ToolIdentityIconProps) {
  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path
        d="M5.2 4.6h12.4a4.8 4.8 0 0 1 4.8 4.8v9.2a4.8 4.8 0 0 1-4.8 4.8H8.4a4.8 4.8 0 0 1-4.8-4.8V6.2a1.6 1.6 0 0 1 1.6-1.6Z"
        fill="currentColor"
        opacity=".18"
        stroke="none"
      />
      <path d="M6.2 4.8h11.3a4.4 4.4 0 0 1 4.4 4.4v9.2a4.4 4.4 0 0 1-4.4 4.4H8.6a4.4 4.4 0 0 1-4.4-4.4V6.8a2 2 0 0 1 2-2Z" />
      <path d="M7.1 8.3h9.8" />
      <path d="M8.1 8.3v3.2M10.2 8.3v1.8M12.3 8.3v3.2M14.5 8.3v1.8M16.7 8.3v3.2" />
      <circle cx="15.7" cy="17.2" r="2.5" />
      <path d="M21.9 14.6h2.2v5.3h-2.2" />
    </svg>
  );
}

export function TimeCostsToolIcon({
  size = 28,
  ...props
}: ToolIdentityIconProps) {
  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11.8" cy="12.1" r="8.1" fill="currentColor" opacity=".18" stroke="none" />
      <circle cx="11.8" cy="12.1" r="8.1" />
      <path d="M11.8 7.6v4.9l3.2 2" />
      <circle cx="20.4" cy="19.6" r="5.2" fill="var(--v2-surface-raised)" />
      <path d="M20.4 16.4v6.4M22.1 17.7c-.5-.4-1-.6-1.7-.6-1 0-1.7.5-1.7 1.2s.6 1.1 1.8 1.3c1.2.2 1.8.6 1.8 1.3 0 .8-.7 1.3-1.9 1.3-.8 0-1.5-.3-2-.8" />
    </svg>
  );
}
