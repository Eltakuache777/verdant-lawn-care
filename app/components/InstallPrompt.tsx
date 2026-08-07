"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";

const DISMISS_KEY = "vlc_install_dismissed";

// Android/Chrome fires beforeinstallprompt and lets a site trigger the real
// native install flow with one tap. iOS Safari has no equivalent API at all
// (Apple deliberately doesn't allow websites to trigger the "Add to Home
// Screen" UI) -- the only thing possible there is showing instructions for
// the visitor to do it themselves via the Share sheet.
export default function InstallPrompt() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    if (isIOS) {
      setPlatform("ios");
      setVisible(true);
      return;
    }

    function handler(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
      setPlatform("android");
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/worker")) return null;
  if (!visible || !platform) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 420,
        margin: "0 auto",
        background: "var(--bg-elevated)",
        border: "1px solid var(--accent)",
        borderRadius: 10,
        padding: 16,
        zIndex: 900,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <p style={{ margin: "0 0 10px", fontSize: 14 }}>
        {platform === "android" ? t("installPromptAndroidText") : t("installPromptIosText")}
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        {platform === "android" && (
          <button type="button" onClick={install} style={{ flex: 1 }}>
            {t("installPromptInstallBtn")}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          style={{ flex: 1, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          {t("installPromptNotNowBtn")}
        </button>
      </div>
    </div>
  );
}
