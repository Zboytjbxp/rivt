export type TradeKey =
  | "Electrician" | "Plumber" | "Carpenter" | "HVAC"
  | "General Contractor" | "Painter" | "Mason" | "Welder"
  | "Roofer" | "Landscaper" | "Other";

export interface TradePersona {
  trade: TradeKey;
  emoji: string;
  jobSectionLabel: string;       // "Plumbing jobs near you"
  shopTalkLabel: string;         // "Plumbing Talk"
  quickActionPhotoLabel: string; // label for the photo quick action button on Home
  safetyFocus: string[];         // SAFETY_CATEGORIES keys to pre-expand
}

export const TRADE_PERSONAS: Record<TradeKey, TradePersona> = {
  Electrician: {
    trade: "Electrician", emoji: "⚡",
    jobSectionLabel: "Electrical jobs near you",
    shopTalkLabel: "Electrical Talk",
    quickActionPhotoLabel: "Panel photo",
    safetyFocus: ["Electrical", "PPE", "Tools & Equipment"],
  },
  Plumber: {
    trade: "Plumber", emoji: "🔧",
    jobSectionLabel: "Plumbing jobs near you",
    shopTalkLabel: "Plumbing Talk",
    quickActionPhotoLabel: "Leak photo",
    safetyFocus: ["PPE", "Tools & Equipment", "Site Access"],
  },
  Carpenter: {
    trade: "Carpenter", emoji: "🪚",
    jobSectionLabel: "Carpentry jobs near you",
    shopTalkLabel: "Carpentry Talk",
    quickActionPhotoLabel: "Frame photo",
    safetyFocus: ["Fall Protection", "PPE", "Tools & Equipment"],
  },
  HVAC: {
    trade: "HVAC", emoji: "❄️",
    jobSectionLabel: "HVAC jobs near you",
    shopTalkLabel: "HVAC Talk",
    quickActionPhotoLabel: "Unit photo",
    safetyFocus: ["Electrical", "PPE", "Tools & Equipment"],
  },
  "General Contractor": {
    trade: "General Contractor", emoji: "🏗️",
    jobSectionLabel: "GC jobs near you",
    shopTalkLabel: "GC Talk",
    quickActionPhotoLabel: "Job photo",
    safetyFocus: ["PPE", "Fall Protection", "Site Access", "Emergency"],
  },
  Painter: {
    trade: "Painter", emoji: "🎨",
    jobSectionLabel: "Painting jobs near you",
    shopTalkLabel: "Painting Talk",
    quickActionPhotoLabel: "Before/after",
    safetyFocus: ["PPE", "Tools & Equipment", "Emergency"],
  },
  Mason: {
    trade: "Mason", emoji: "🧱",
    jobSectionLabel: "Masonry jobs near you",
    shopTalkLabel: "Masonry Talk",
    quickActionPhotoLabel: "Work photo",
    safetyFocus: ["Fall Protection", "PPE", "Site Access"],
  },
  Welder: {
    trade: "Welder", emoji: "🔥",
    jobSectionLabel: "Welding jobs near you",
    shopTalkLabel: "Welding Talk",
    quickActionPhotoLabel: "Weld photo",
    safetyFocus: ["PPE", "Tools & Equipment", "Emergency"],
  },
  Roofer: {
    trade: "Roofer", emoji: "🏠",
    jobSectionLabel: "Roofing jobs near you",
    shopTalkLabel: "Roofing Talk",
    quickActionPhotoLabel: "Roof photo",
    safetyFocus: ["Fall Protection", "PPE", "Emergency"],
  },
  Landscaper: {
    trade: "Landscaper", emoji: "🌿",
    jobSectionLabel: "Landscaping jobs near you",
    shopTalkLabel: "Landscaping Talk",
    quickActionPhotoLabel: "Site photo",
    safetyFocus: ["PPE", "Tools & Equipment", "Site Access"],
  },
  Other: {
    trade: "Other", emoji: "🔨",
    jobSectionLabel: "Jobs near you",
    shopTalkLabel: "Shop Talk",
    quickActionPhotoLabel: "Job photo",
    safetyFocus: ["PPE", "Tools & Equipment"],
  },
};

export function getPersona(trade: string | null | undefined): TradePersona | null {
  if (!trade) return null;
  return TRADE_PERSONAS[trade as TradeKey] ?? null;
}
