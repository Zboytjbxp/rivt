import { ContactPicker } from "../contacts/ContactPicker";
import {
  contactAddressValue,
  contactMethodValue,
  type ContactRecord,
} from "../network/contacts-api";
import type {
  ClientRecord,
  CustomerContactMethod,
} from "./client-records";

interface CustomerPickerProps {
  selectedCustomerId?: string | null;
  onSelect: (customer: ClientRecord | null) => void;
  label?: string;
}

function stringDetail(value: unknown) {
  return typeof value === "string" ? value : "";
}

function customerFromContact(contact: ContactRecord): ClientRecord {
  const customerDetails = contact.roles.find(({ role }) => role === "customer")?.details ?? {};
  const preferred = stringDetail(customerDetails.preferredContactMethod);
  return {
    id: contact.id,
    legacyLocalId: contact.id,
    name: contact.name,
    company: contact.company,
    phone: contactMethodValue(contact, "phone"),
    email: contactMethodValue(contact, "email").toLowerCase(),
    billingAddress: contactAddressValue(contact, "billing"),
    serviceAddress: contactAddressValue(contact, "service"),
    notes: contact.notes,
    preferredContactMethod: ["email", "phone", "sms"].includes(preferred)
      ? preferred as CustomerContactMethod
      : "none",
    defaultTerms: stringDetail(customerDetails.defaultTerms),
    favorite: contact.favorite,
    status: contact.status,
    createdAt: contact.createdAt ?? new Date().toISOString(),
    updatedAt: contact.updatedAt ?? new Date().toISOString(),
    lastUsedAt: contact.lastUsedAt,
    threadMessages: [],
  };
}

export function CustomerPicker({
  selectedCustomerId = null,
  onSelect,
  label = "Customer",
}: CustomerPickerProps) {
  return (
    <ContactPicker
      selectedContactId={selectedCustomerId}
      onSelect={(contact) => onSelect(contact ? customerFromContact(contact) : null)}
      role="customer"
      label={label}
      helper="Choose from Contacts or create a customer without leaving this form."
    />
  );
}
