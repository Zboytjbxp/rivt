import type { PrimaryDestination } from "./types";

export type NavLabel =
  | "Home"
  | "Work"
  | "Shop Talk"
  | "Tools"
  | "My Jobs"
  | "Applications"
  | "Invites"
  | "Crew"
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
  if (["Work", "My Jobs", "Applications", "Invites"].includes(view)) return "work";
  if (["Crew", "Reviews"].includes(view)) return "crew";
  if (view === "Shop Talk") return "shop-talk";
  if (["Tools", "Records"].includes(view)) return "tools";
  return null;
}

export function defaultViewForDestination(destination: PrimaryDestination): NavLabel {
  if (destination === "home") return "Home";
  if (destination === "work") return "Work";
  if (destination === "crew") return "Crew";
  if (destination === "shop-talk") return "Shop Talk";
  if (destination === "messages") return "Messages";
  return "Tools";
}

export const viewRoutes: Record<NavLabel, string> = {
  Home: "/app",
  Work: "/app/work",
  "Shop Talk": "/app/network/talk",
  Tools: "/app/tools",
  "My Jobs": "/app/work",
  Applications: "/app/work",
  Invites: "/app/work",
  Crew: "/app/network",
  Messages: "/app/inbox",
  "Trust & Legal": "/app/profile/trust",
  Records: "/app/tools/records",
  "Safety & Training": "/app/profile/training",
  Reviews: "/app/profile/reviews",
  Feedback: "/app/profile/feedback",
  Settings: "/app/profile/settings",
  Admin: "/app/admin",
};

export function viewFromPath(pathname: string): NavLabel {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const aliases: Record<string, NavLabel> = {
    "/app/home": "Home",
    "/app/work/jobs": "Work",
    "/app/work/applications": "Work",
    "/app/work/invites": "Work",
    "/app/shop-talk": "Shop Talk",
    "/app/network/talk": "Shop Talk",
    "/app/crew": "Crew",
    "/app/messages": "Messages",
    "/app/network/reviews": "Reviews",
    "/app/profile": "Settings",
    "/app/profile/trust": "Trust & Legal",
    "/app/profile/training": "Safety & Training",
    "/app/profile/reviews": "Reviews",
    "/app/profile/feedback": "Feedback",
    "/app/profile/settings": "Settings",
    "/app/records": "Records",
    "/app/tools/records": "Records",
    "/app/admin": "Admin",
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
  Work: {
    title: "Work",
    description: "Post paid side work, find openings, and keep each work order record clean.",
  },
  "Shop Talk": {
    title: "Shop Talk",
    description: "Ask field questions and get answers from tradespeople who've solved it.",
  },
  Tools: {
    title: "Tools",
    description: "Calculator, invoices, estimates, logs, and records.",
  },
  "My Jobs": {
    title: "Work",
    description: "Track jobs from posted to paid and closed.",
  },
  Applications: {
    title: "Work",
    description: "Review applications and good matches.",
  },
  Invites: {
    title: "Work",
    description: "Track crew follow-ups and job conversations.",
  },
  Crew: {
    title: "Crew",
    description: "People, reviews, clients, and saved subs.",
  },
  Messages: {
    title: "Messages",
    description: "Job messages and notifications.",
  },
  "Trust & Legal": {
    title: "Trust & Legal",
    description: "Keep consent, account data, and address privacy clear.",
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
    description: "Account, theme, notifications, and profile controls.",
  },
  Admin: {
    title: "Admin",
    description: "Moderation, support, and launch operations.",
  },
};
