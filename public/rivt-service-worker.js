if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const appModule = document.querySelector('script[type="module"][src]');
    const buildId = appModule
      ? new URL(appModule.src, window.location.href).pathname
      : "development";
    const updateNotice = document.getElementById("rivt-update-notice");
    const updateRefresh = document.getElementById("rivt-update-refresh");
    const updateDismiss = document.getElementById("rivt-update-dismiss");
    const hideUpdateNotice = () => {
      updateNotice?.classList.remove("is-visible");
    };

    updateRefresh?.addEventListener("click", () => window.location.reload());
    updateDismiss?.addEventListener("click", hideUpdateNotice);

    navigator.serviceWorker.register(
      `/sw.js?build=${encodeURIComponent(buildId)}`,
      { updateViaCache: "none" },
    ).then((registration) => {
      registration.update().catch(() => {});
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController) return;
        if (document.visibilityState === "hidden") {
          window.location.reload();
          return;
        }
        updateNotice?.classList.add("is-visible");
        window.setTimeout(hideUpdateNotice, 15_000);
      }, { once: true });
    }).catch(() => {});
  });
}
