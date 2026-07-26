import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISSED_KEY = "rivt.install-prompt.dismissed.v1";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosBrowser() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    && !("MSStream" in window);
}

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(() => (
    !isStandalone() && !wasDismissed() && isIosBrowser()
  ));

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setShowIosHint(false);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  function dismiss() {
    try { window.localStorage.setItem(DISMISSED_KEY, "true"); } catch { /* best effort */ }
    setInstallEvent(null);
    setShowIosHint(false);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setInstallEvent(null);
  }

  if (!installEvent && !showIosHint) return null;

  return (
    <aside className="v2-install-prompt" aria-label="Install RIVT">
      <span className="v2-install-prompt-icon" aria-hidden="true">
        {installEvent ? <Download size={20} /> : <Share2 size={20} />}
      </span>
      <div>
        <strong>{installEvent ? "Install RIVT" : "Add RIVT to your Home Screen"}</strong>
        <small>
          {installEvent
            ? "Open RIVT faster from your phone and keep the app shell available on weak connections."
            : "In Safari, tap Share, then Add to Home Screen."}
        </small>
      </div>
      {installEvent ? <button type="button" className="v2-primary-button" onClick={() => void install()}>Install</button> : null}
      <button type="button" className="v2-icon-button" aria-label="Dismiss install prompt" onClick={dismiss}>
        <X size={18} />
      </button>
    </aside>
  );
}
