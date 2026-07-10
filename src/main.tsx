import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppBootstrap } from "./AppBootstrap";
import "./styles.css";

// Handle return from checkout without granting frontend-only entitlements.
// Paid access must come from server-owned billing state before production
// features are unlocked.
(function handleUpgradeReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("upgraded") === "1") {
    try { sessionStorage.setItem("rivt.billing.returned.v1", new Date().toISOString()); } catch { /* noop */ }
    // Clean the URL so refreshing does not re-trigger local state.
    const clean = window.location.pathname + window.location.hash;
    window.history.replaceState({}, "", clean);
  }
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppBootstrap>
      <App />
    </AppBootstrap>
  </StrictMode>,
);
