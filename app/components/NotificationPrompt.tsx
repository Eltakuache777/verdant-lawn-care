"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";

const DISMISS_KEY = "vlc_notif_dismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function NotificationPrompt() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((session) => {
        const chatEmail = localStorage.getItem("chatEmail");
        const identity = session?.loggedIn ? session.email : chatEmail;
        if (identity) {
          setEmail(identity);
          setVisible(true);
        }
      });
  }, []);

  async function enable() {
    setEnabling(true);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subscription: subscription.toJSON() }),
      });
      setVisible(false);
    } catch (err) {
      console.error("Failed to enable notifications:", err);
      setVisible(false);
    } finally {
      setEnabling(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

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
      <p style={{ margin: "0 0 10px", fontSize: 14 }}>{t("notifPromptText")}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={enable} disabled={enabling} style={{ flex: 1 }}>
          {enabling ? t("notifEnablingBtn") : t("notifEnableBtn")}
        </button>
        <button
          type="button"
          onClick={dismiss}
          style={{ flex: 1, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          {t("notifNotNowBtn")}
        </button>
      </div>
    </div>
  );
}
