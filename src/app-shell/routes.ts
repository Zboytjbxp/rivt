import type { PrimaryDestination } from "./types";

export type NavLabel =
  | "Home"
  | "Marketplace"
  | "Shop Talk"
  | "Tools"
  | "My Jobs"
  | "Applications"
  | "Invites"
  | "My Crew"
  | "Messages"
  | "Trust & Legal"
  | "Records"
  | "Safety & Training"
  | "Reviews"
  | "Feedback"
  | "Settings"
  | "Admin";

export function primaryDestinationForView(view: NavLabel): PrimaryDestination | null {
  if (view === "Home") return "home";
  if (["Marketplace", "My Jobs", "Applications", "Invites"].includes(view)) return "work";
  if (["My Crew", "Reviews"].includes(view)) return "crew";
  if (view === "Shop Talk") return "shop-talk";
  if (["Tools", "Records"].includes(view)) return "tools";
  return null;
}

export function defaultViewForDestination(destination: PrimaryDestination): NavLabel {
  if (destination === "home") return "Home";
  if (destination === "work") return "Marketplace";
  if (destination === "crew") return "My Crew";
  if (destination === "shop-talk") return "Shop Talk";
  if (destination === "messages") return "Messages";
  return "Tools";
}

export const viewRoutes: Record<NavLabel, string> = {
  Home: "/app",
  Marketplace: "/app/work",
  "Shop Talk": "/app/network/talk",
  Tools: "/app/tools",
  "My Jobs": "/app/work",
  Applications: "/app/work",
  Invites: "/app/work",
  "My Crew": "/app/network",
  Messages: "/app/inbox",
  "Trust & Legal": "/app/profile/trust",
  Records: "/app/tools/records",
  "Safety & Training": "/app/profile/training",
  Reviews: "/app/profile/reviews",
  Feedback: "/app/profile/feedback",
  Settings: "/app/profile/settings",
  Admin: "/admin",
};

export function viewFromPath(pathname: string): NavLabel {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const aliases: Record<string, NavLabel> = {
    "/app/work/jobs": "Marketplace",
    "/app/work/applications": "Marketplace",
    "/app/work/invites": "Marketplace",
    "/app/network/talk": "Shop Talk",
    "/app/network/reviews": "Reviews",
    "/app/profile/trust": "Trust & Legal",
    "/app/profile/training": "Safety & Training",
    "/app/profile/reviews": "Reviews",
    "/app/profile/feedback": "Feedback",
    "/app/profile/settings": "Settings",
    "/app/tools/records": "Records",
  };
  if (aliases[normalized]) return aliases[normalized];
  const match = (Object.entries(viewRoutes) as Array<[NavLabel, string]>).find(([, route]) => route === normalized);
  return match?.[0] ?? "Home";
}

export const pageCopy: Record<NavLabel, { title: string; description: string }> = {
  Home: {
    title: "Home",
    description: "Your daily trade feed: news, Shop Talk, shout-outs, tools, and work signal.",
  },
  Marketplace: {
    title: "Work Feed",
    description: "Post paid side work, find openings, and keep each work order record clean.",
  },
  "Shop Talk": {
    title: "Shop Talk",
    description: "Ask field questions and get answers from tradespeople who've solved it.",
  },
  Tools: {
    title: "Tools",
    description: "Invoice builder, estimate calculator, and field tools for active work orders.",
  },
  "My Jobs": {
    title: "My Jobs",
    description: "Track each job from posted to paid and closed.",
  },
  Applications: {
    title: "Applications",
    description: "See who raised a hand and move fast on good matches.",
  },
  Invites: {
    title: "Invites",
    description: "Invite nearby tradespeople who fit the job.",
  },
  "My Crew": {
    title: "My Crew",
    description: "Compare specialties, tools, self-reported insurance, and availability.",
  },
  Messages: {
    title: "Messages",
    description: "Keep job messages in one permanent thread.",
  },
  "Trust & Legal": {
    title: "Trust & Legal",
    description: "Keep consent, ID readiness, and address privacy clear.",
  },
  Records: {
    title: "Records",
    description: "Keep completion photos, payment notes, and closeout history together.",
  },
  "Safety & Training": {
    title: "Safety & Training",
    description: "Track required training and job-site risk controls.",
  },
  Reviews: {
    title: "Reviews",
    description: "Protect trust with closeout ratings and review requests.",
  },
  Feedback: {
    title: "Feedback",
    description: "Tell us what's working, what's confusing, and what you need next.",
  },
  Settings: {
    title: "Settings",
    description: "Review account status, trust readiness, and launch checklist.",
  },
  Admin: {
    title: "Admin",
    description: "Watch the beta, handle reports, and keep bad accounts out.",
  },
};
