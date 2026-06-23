import type { Difficulty, Trade, WorkType } from "../../types";
import type { CanonicalDifficulty, CanonicalWorkType } from "./job-api";

export const tradeCodeByName: Record<Trade, string> = {
  Electrical: "electrical",
  Plumbing: "plumbing",
  HVAC: "hvac",
  Carpentry: "carpentry",
  Cabinetry: "cabinetry",
  "Painting/Finishing": "painting_finishing",
  Welding: "welding",
  Roofing: "roofing",
  Flooring: "flooring",
  Drywall: "drywall",
  "Concrete/Masonry": "concrete_masonry",
  Landscaping: "landscaping",
  Tile: "tile",
  Insulation: "insulation",
  Framing: "framing",
  "General Labor": "general_labor",
  Demolition: "demolition",
  Excavation: "excavation",
  Fencing: "fencing",
  Gutters: "gutters",
  "Windows/Doors": "windows_doors",
  Siding: "siding",
  "Driveways/Pavers": "driveways_pavers",
  "Pool/Spa": "pool_spa",
  "Fire Suppression": "fire_protection",
  "Low Voltage": "low_voltage",
  Solar: "solar",
  "Security Systems": "security_systems",
};

export const canonicalDifficultyByLabel: Record<Difficulty, CanonicalDifficulty> = {
  Easy: "easy",
  Moderate: "moderate",
  Challenging: "challenging",
  Advanced: "advanced",
  Expert: "expert",
};

export const canonicalWorkTypeByLabel: Record<WorkType, CanonicalWorkType> = {
  "Side work": "side_work",
  Emergency: "emergency",
  "Multi-day": "multi_day",
  "Inspection prep": "inspection_prep",
};
