import { useCallback, useEffect, useMemo, useState } from "react";
import type { InboxNotification } from "../features/inbox/inbox-api";
import { currentTimeLabel, recordServerEvent } from "../lib/app-helpers";
import type { Role } from "../types";
import type { ActivityItem, AppToast } from "./app-state-types";
import type { NavLabel } from "./routes";

interface UseActivityFeedOptions {
  activeView: NavLabel;
  notifications: InboxNotification[];
  role: Role;
}

function notificationActionLabel(item: InboxNotification): string | undefined {
  const source = `${item.type} ${item.sourceType} ${item.actionHref}`.toLowerCase();
  if (source.includes("message") || source.includes("conversation") || source.includes("inbox")) return "Open message";
  if (source.includes("shop-talk") || source.includes("community") || source.includes("answer")) return "Open Shop Talk";
  if (source.includes("work") || source.includes("job") || source.includes("offer")) return "Open work";
  if (source.includes("record") || source.includes("project") || source.includes("photo") || source.includes("media") || source.includes("tool")) return "Open records";
  if (source.includes("profile") || source.includes("review") || source.includes("account")) return "Open profile";
  if (source.includes("support") || source.includes("feedback")) return "Open support";
  return item.actionHref ? "Open" : undefined;
}

export function useActivityFeed({ activeView, notifications, role }: UseActivityFeedOptions) {
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [uiToast, setUiToast] = useState<AppToast | null>(null);

  const notificationActivityItems = useMemo<ActivityItem[]>(() => notifications.map((item) => ({
    id: item.id,
    title: item.title,
    detail: item.body,
    timestamp: item.createdAt ? new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "",
    unread: !item.readAt,
    actionLabel: notificationActionLabel(item),
    kind: item.priority === "high" ? "warning" : item.type === "message" ? "info" : "success",
  })), [notifications]);

  const unreadActivities = notifications.filter((item) => !item.readAt).length;
  const activityItems = notificationActivityItems.length ? notificationActivityItems : activityFeed;

  const addActivity = useCallback((title: string, detail: string, kind: AppToast["kind"] = "info") => {
    void recordServerEvent("activity", { title, detail, role, activeView });
    setUiToast({
      id: Date.now(),
      title,
      detail,
      kind,
      timestamp: currentTimeLabel(),
    });
    setActivityFeed((current) => [
      {
        id: Date.now() + current.length,
        title,
        detail,
        timestamp: currentTimeLabel(),
        unread: true,
        kind,
      },
      ...current,
    ].slice(0, 16));
  }, [activeView, role]);

  const dismissToast = useCallback(() => {
    setUiToast(null);
  }, []);

  const markAllActivityRead = useCallback(() => {
    setActivityFeed((current) =>
      current.map((item) => ({ ...item, unread: false })),
    );
  }, []);

  useEffect(() => {
    if (!uiToast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setUiToast(null);
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [uiToast]);

  return {
    activityItems,
    addActivity,
    dismissToast,
    markAllActivityRead,
    uiToast,
    unreadActivities,
  };
}
