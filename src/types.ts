export type Role = "contractor" | "tradesperson";

export type Difficulty = "Easy" | "Moderate" | "Challenging" | "Advanced" | "Expert";

export type Trade =
  | "Electrical"
  | "Plumbing"
  | "HVAC"
  | "Carpentry"
  | "Cabinetry"
  | "Painting/Finishing"
  | "Welding"
  | "Roofing"
  | "Flooring"
  | "Drywall"
  | "Concrete/Masonry"
  | "Landscaping"
  | "Tile"
  | "Insulation"
  | "Framing"
  | "General Labor"
  | "Demolition"
  | "Excavation"
  | "Fencing"
  | "Gutters"
  | "Windows/Doors"
  | "Siding"
  | "Driveways/Pavers"
  | "Pool/Spa"
  | "Fire Suppression"
  | "Low Voltage"
  | "Solar"
  | "Security Systems";

export type TrustRequirement =
  | "Legal agreement required"
  | "ID check required"
  | "Completion photos required";

export type WorkType = "Side work" | "Emergency" | "Multi-day" | "Inspection prep";

export interface Job {
  id: number;
  title: string;
  contractor: string;
  trade: Trade;
  location: string;
  state: string;
  distance: number;
  pay: number;
  durationHours: number;
  workType: WorkType;
  difficulty: Difficulty;
  insuranceRequired: boolean;
  tools: string[];
  trustRequirement: TrustRequirement;
  addressPolicy: string;
  posted: string;
  match: number;
  rating: number;
  reviewCount: number;
  applicants: number;
  status:
    | "Open"
    | "Shortlisting"
    | "Scheduled"
    | "Completion Pending"
    | "Payment Pending"
    | "Paid / Closed";
  summary: string;
  guidance: string[];
  risks: string[];
  deliverables: string[];
  matchFactors: string[];
  requiredQuizIds?: string[];
}

export interface Talent {
  id: number;
  name: string;
  trade: Trade;
  location: string;
  rating: number;
  reviews: number;
  verified: boolean;
  identityVerified: boolean;
  insured: boolean;
  match: number;
  rate: number;
  portfolio: string[];
  tools: string[];
  availability: string;
  responseTime: string;
}

export interface ApplicationRecord {
  jobId: number;
  talentId: number;
  state: "Submitted" | "Invited";
}
