(function initializeBootRecovery() {
  const fallback = document.getElementById("rivt-boot-fallback");
  const copy = document.getElementById("rivt-boot-copy");
  const refresh = document.getElementById("rivt-boot-refresh");
  const ready = () => document.documentElement.classList.contains("rivt-app-ready");
  const showRecovery = () => {
    if (!fallback || ready()) return;
    fallback.classList.add("is-recovery");
    fallback.setAttribute("role", "alert");
    if (copy) {
      copy.textContent = "This phone may be holding an older RIVT update. Refresh to load the latest version.";
    }
  };
  const refreshShell = async () => {
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
  };

  refresh?.addEventListener("click", refreshShell);
  window.addEventListener("error", showRecovery);
  window.addEventListener("unhandledrejection", showRecovery);
  window.setTimeout(showRecovery, 12_000);
})();
