import type { Job, Talent } from "./types";

export const jobs: Job[] = [];

export const talent: Talent[] = [];

export const tradeOptions = [
  "All trades",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Carpentry",
  "Cabinetry",
  "Painting/Finishing",
  "Welding",
  "Roofing",
  "Flooring",
  "Drywall",
  "Concrete/Masonry",
  "Landscaping",
  "Tile",
  "Insulation",
  "Framing",
  "General Labor",
  "Demolition",
  "Excavation",
  "Fencing",
  "Gutters",
  "Windows/Doors",
  "Siding",
  "Driveways/Pavers",
  "Pool/Spa",
  "Fire Suppression",
  "Low Voltage",
  "Solar",
  "Security Systems",
] as const;

export const difficultyOptions = [
  "Any difficulty",
  "Easy",
  "Moderate",
  "Challenging",
  "Advanced",
  "Expert",
] as const;

export const workTypeOptions = [
  "All work types",
  "Side work",
  "Emergency",
  "Multi-day",
  "Inspection prep",
] as const;

export const radiusOptions = ["Any radius", "5 mi", "10 mi", "25 mi"] as const;
