import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Handle return from Stripe checkout
(function handleUpgradeReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("upgraded") === "1") {
    try {
      localStorage.setItem(
        "rivt.pro.v1",
        JSON.stringify({ active: true, activatedAt: new Date().toISOString() })
      );
    } catch {}
    // Clean the URL so refreshing doesn't re-trigger
    const clean = window.location.pathname + window.location.hash;
    window.history.replaceState({}, "", clean);
  }
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
