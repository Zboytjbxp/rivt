import { apiPath, fetchWithTimeout, notifySessionExpired, RivtApiError } from "../../lib/api";

export type DocumentStyle = "classic" | "compact" | "field";

export interface DocumentBrand {
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessAddress: string;
  website: string;
  licenseNumber: string;
  estimateStyle: DocumentStyle;
  invoiceStyle: DocumentStyle;
  showContact: boolean;
  showAddress: boolean;
  showLicense: boolean;
  logoUploadId: string | null;
  logoUrl: string | null;
  updatedAt: string | null;
}

export const documentStyleOptions: Array<{
  id: DocumentStyle;
  name: string;
  description: string;
}> = [
  { id: "classic", name: "Classic", description: "Strong branded header and familiar totals." },
  { id: "compact", name: "Compact", description: "Clean letterhead with less visual weight." },
  { id: "field", name: "Field", description: "High-contrast header built for quick scanning." },
];

export function defaultDocumentBrand(businessName = "RIVT member", businessEmail = ""): DocumentBrand {
  return {
    businessName,
    businessEmail,
    businessPhone: "",
    businessAddress: "",
    website: "",
    licenseNumber: "",
    estimateStyle: "classic",
    invoiceStyle: "classic",
    showContact: true,
    showAddress: true,
    showLicense: true,
    logoUploadId: null,
    logoUrl: null,
    updatedAt: null,
  };
}

async function documentBrandResponse(response: Response, fallbackMessage: string): Promise<DocumentBrand> {
  const body = await response.json().catch(() => null) as {
    data?: { brand?: DocumentBrand };
    error?: { code?: string; message?: string; details?: unknown };
  } | null;
  if (response.status === 401) notifySessionExpired();
  if (!response.ok || !body?.data?.brand) {
    throw new RivtApiError(response.status, body ?? {}, fallbackMessage);
  }
  return body.data.brand;
}

export async function fetchDocumentBrand(): Promise<DocumentBrand> {
  const response = await fetchWithTimeout(apiPath("/api/v1/document-brand"), {
    credentials: "include",
  });
  return documentBrandResponse(response, "RIVT could not load document branding.");
}

export async function saveDocumentBrand(brand: DocumentBrand): Promise<DocumentBrand> {
  const response = await fetchWithTimeout(apiPath("/api/v1/document-brand"), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessName: brand.businessName,
      businessEmail: brand.businessEmail,
      businessPhone: brand.businessPhone,
      businessAddress: brand.businessAddress,
      website: brand.website,
      licenseNumber: brand.licenseNumber,
      estimateStyle: brand.estimateStyle,
      invoiceStyle: brand.invoiceStyle,
      showContact: brand.showContact,
      showAddress: brand.showAddress,
      showLicense: brand.showLicense,
    }),
  });
  return documentBrandResponse(response, "RIVT could not save document branding.");
}

export async function uploadDocumentLogo(file: File): Promise<DocumentBrand> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetchWithTimeout(apiPath("/api/v1/document-brand/logo"), {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return documentBrandResponse(response, "RIVT could not upload that logo.");
}

export async function removeDocumentLogo(): Promise<DocumentBrand> {
  const response = await fetchWithTimeout(apiPath("/api/v1/document-brand/logo"), {
    method: "DELETE",
    credentials: "include",
  });
  return documentBrandResponse(response, "RIVT could not remove that logo.");
}

export function documentBrandContactLines(brand: DocumentBrand): string[] {
  const values: string[] = [];
  if (brand.showContact && brand.businessPhone.trim()) values.push(brand.businessPhone.trim());
  if (brand.showContact && brand.businessEmail.trim()) values.push(brand.businessEmail.trim());
  if (brand.showContact && brand.website.trim()) values.push(brand.website.trim());
  if (brand.showAddress && brand.businessAddress.trim()) values.push(brand.businessAddress.trim());
  if (brand.showLicense && brand.licenseNumber.trim()) values.push(`License ${brand.licenseNumber.trim()}`);
  return values;
}
