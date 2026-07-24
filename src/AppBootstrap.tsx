import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { installClientErrorReporting, reportClientError } from "./lib/client-error-reporting";

async function refreshClientShell() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } finally {
    window.location.replace("/");
  }
}

function AppReadySignal({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("rivt-app-ready");
    return installClientErrorReporting();
  }, []);

  return children;
}

export function AppBootstrap({ children }: { children: ReactNode }) {
  return (
    <AppBootstrapBoundary>
      <AppReadySignal>{children}</AppReadySignal>
    </AppBootstrapBoundary>
  );
}

class AppBootstrapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportClientError(error, {
      boundary: "app-bootstrap",
      componentStack: errorInfo.componentStack,
    });
    // Hide the static boot layer once React can present a useful recovery action.
    document.documentElement.classList.add("rivt-app-ready");
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-bootstrap-recovery" role="alert" aria-live="assertive">
          <section>
            <span>RIVT update</span>
            <h1>RIVT needs a quick refresh.</h1>
            <p>Your account and records are safe. Refreshing reloads the latest app shell on this phone.</p>
            <button type="button" onClick={() => void refreshClientShell()}>Refresh RIVT</button>
            <button type="button" onClick={() => window.location.assign("/")}>Back to start</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
