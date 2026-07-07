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

function notificationActionLabel(notification: InboxNotification) {
  const href = notification.actionHref || "";
  if (
    notification.sourceType.startsWith("shop_talk") ||
    typeof notification.metadata?.postId === "string" ||
    typeof notification.metadata?.post_id === "string" ||
    href.includes("shop-talk")
  ) {
    return href.includes("community") ? "Open community" : "Open post";
  }
  if (
    notification.sourceType === "offer" ||
    notification.sourceType === "job" ||
    typeof notification.metadata?.jobId === "string" ||
    typeof notification.metadata?.job_id === "string" ||
    href.includes("work")
  ) {
    return "Open work";
  }
  if (notification.sourceType === "active_work") {
    return "Open active work";
  }
  if (
    notification.sourceType === "message" ||
    typeof notification.metadata?.conversationId === "string" ||
    href.includes("messages")
  ) {
    return "Open message";
  }
  if (notification.sourceType === "project" || href.includes("tools")) {
    return "Open records";
  }
  if (notification.sourceType === "support" || href.includes("support") || href.includes("feedback")) {
    return "Open support";
  }
  if (notification.sourceType === "review" || href.includes("review")) {
    return "Open review";
  }
  if (href.includes("profile") || href.includes("account")) {
    return "Open profile";
  }
  return "Open";
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
    kind: item.priority === "high" ? "warning" : item.type === "message" ? "info" : "success",
    actionLabel: notificationActionLabel(item),
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
