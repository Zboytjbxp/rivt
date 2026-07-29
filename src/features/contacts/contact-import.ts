import {
  type ContactAddress,
  type ContactInput,
  type ContactRole,
} from "../network/contacts-api";

interface DevicePostalAddress {
  addressLine?: string[];
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

interface DeviceContact {
  name?: string[];
  email?: string[];
  tel?: string[];
  address?: DevicePostalAddress[];
}

interface DeviceContactsManager {
  getProperties?: () => Promise<string[]>;
  select: (
    properties: string[],
    options: { multiple: boolean },
  ) => Promise<DeviceContact[]>;
}

function contactsManager() {
  if (typeof navigator === "undefined") return null;
  const manager = (navigator as Navigator & {
    contacts?: DeviceContactsManager;
  }).contacts;
  return manager && typeof manager.select === "function" ? manager : null;
}

function importedRole(role: ContactRole) {
  return [{ role, status: "active" as const, details: {} }];
}

function importedMethods(contact: DeviceContact) {
  const emails = [...new Set((contact.email ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean))];
  const phones = [...new Set((contact.tel ?? []).map((value) => value.trim()).filter(Boolean))];
  return [
    ...emails.map((value, index) => ({
      kind: "email" as const,
      label: index === 0 ? "Primary" : "Other",
      value,
      isPrimary: index === 0,
    })),
    ...phones.map((value, index) => ({
      kind: "phone" as const,
      label: index === 0 ? "Primary" : "Other",
      value,
      isPrimary: index === 0,
    })),
  ];
}

function formatDeviceAddress(address: DevicePostalAddress) {
  return [
    ...(address.addressLine ?? []),
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ].map((value) => value?.trim()).filter(Boolean).join(", ");
}

function importedAddresses(contact: DeviceContact): ContactAddress[] {
  return (contact.address ?? [])
    .map(formatDeviceAddress)
    .filter(Boolean)
    .map((address, index) => ({
      kind: "other" as const,
      label: index === 0 ? "Primary" : "Other",
      address,
      isPrimary: index === 0,
    }));
}

function inputFromDeviceContact(contact: DeviceContact, role: ContactRole): ContactInput | null {
  const methods = importedMethods(contact);
  const name = contact.name?.find((value) => value.trim())?.trim()
    || methods[0]?.value
    || "";
  if (!name) return null;
  return {
    entityType: "person",
    name,
    company: "",
    notes: "",
    favorite: false,
    status: "active",
    roles: importedRole(role),
    methods,
    addresses: importedAddresses(contact),
    tags: [],
  };
}

export function deviceContactPickerSupported() {
  return Boolean(contactsManager());
}

export async function pickDeviceContacts({
  multiple,
  role,
}: {
  multiple: boolean;
  role: ContactRole;
}): Promise<ContactInput[]> {
  const manager = contactsManager();
  if (!manager) return [];
  const available = manager.getProperties
    ? await manager.getProperties().catch(() => ["name", "email", "tel"])
    : ["name", "email", "tel"];
  const requested = ["name", "email", "tel", "address"].filter((property) => available.includes(property));
  const selected = await manager.select(requested.length ? requested : ["name"], { multiple });
  return selected
    .map((contact) => inputFromDeviceContact(contact, role))
    .filter((contact): contact is ContactInput => Boolean(contact));
}

function unfoldVCard(value: string) {
  return value
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .replace(/\r/g, "\n");
}

function decodeVCardValue(value: string) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function vCardProperty(lines: string[], name: string) {
  return lines
    .filter((line) => line.split(":", 1)[0]?.split(";", 1)[0]?.toUpperCase() === name)
    .map((line) => decodeVCardValue(line.slice(line.indexOf(":") + 1)))
    .filter(Boolean);
}

function vCardName(lines: string[]) {
  const fullName = vCardProperty(lines, "FN")[0];
  if (fullName) return fullName;
  const structured = vCardProperty(lines, "N")[0]?.split(";") ?? [];
  return [structured[1], structured[2], structured[0], structured[3]]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
}

function vCardAddress(value: string) {
  const parts = value.split(";").map((part) => part.trim()).filter(Boolean);
  return parts.join(", ");
}

export function parseContactsVCard(
  source: string,
  defaultRole: ContactRole = "other",
): { contacts: ContactInput[]; skipped: number } {
  const cards = unfoldVCard(source).match(/BEGIN:VCARD\n[\s\S]*?END:VCARD/gi) ?? [];
  const contacts: ContactInput[] = [];
  let skipped = 0;
  for (const card of cards.slice(0, 500)) {
    const lines = card.split("\n").map((line) => line.trim()).filter(Boolean);
    const emails = [...new Set(vCardProperty(lines, "EMAIL").map((value) => value.toLowerCase()))];
    const phones = [...new Set(vCardProperty(lines, "TEL"))];
    const company = vCardProperty(lines, "ORG")[0]?.split(";")[0]?.trim() ?? "";
    const name = vCardName(lines) || company || emails[0] || phones[0] || "";
    if (!name) {
      skipped += 1;
      continue;
    }
    const addresses = vCardProperty(lines, "ADR").map(vCardAddress).filter(Boolean);
    contacts.push({
      entityType: company && name === company ? "company" : "person",
      name,
      company: name === company ? "" : company,
      notes: "",
      favorite: false,
      status: "active",
      roles: importedRole(defaultRole),
      methods: [
        ...emails.map((value, index) => ({
          kind: "email" as const,
          label: index === 0 ? "Primary" : "Other",
          value,
          isPrimary: index === 0,
        })),
        ...phones.map((value, index) => ({
          kind: "phone" as const,
          label: index === 0 ? "Primary" : "Other",
          value,
          isPrimary: index === 0,
        })),
      ],
      addresses: addresses.map((address, index) => ({
        kind: "other" as const,
        label: index === 0 ? "Primary" : "Other",
        address,
        isPrimary: index === 0,
      })),
      tags: [],
    });
  }
  return {
    contacts,
    skipped: skipped + Math.max(0, cards.length - 500),
  };
}
