import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import "./OfflineBanner.css";

export function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [visible, setVisible] = useState(!navigator.onLine);
  const [showOnline, setShowOnline] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleOffline() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setOnline(false);
      setShowOnline(false);
      setVisible(true);
    }

    function handleOnline() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setOnline(true);
      setShowOnline(true);
      setVisible(true);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        setShowOnline(false);
      }, 2500);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!visible) return null;

  const isHidden = false;
  const stateClass = showOnline ? "is-online" : "is-offline";

  return (
    <div
      className={`rivt-offline-banner ${stateClass}${isHidden ? " is-hidden" : ""}`}
      role="status"
      aria-live="polite"
    >
      {!online && <WifiOff size={14} aria-hidden="true" />}
      {showOnline ? "Back online" : "No internet - changes will sync when you're back online"}
    </div>
  );
}
