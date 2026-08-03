"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { useFeedback } from "./FeedbackContext";

export default function FeedbackWidget() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { open, setOpen } = useFeedback();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/worker")) return null;
  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email, page: pathname }),
      });
      if (res.ok) {
        setSent(true);
        setMessage("");
        setEmail("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setOpen(false);
    setSent(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={close}
    >
      <div
        className="card"
        style={{ maxWidth: 420, width: "100%", margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>{t("feedbackTitle")}</h1>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{ background: "transparent", color: "var(--text-muted)", padding: "4px 8px", fontWeight: 700, fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        {sent ? (
          <>
            <p className="accent" style={{ marginTop: 12 }}>
              {t("feedbackThanks")}
            </p>
            <button type="button" onClick={close} style={{ marginTop: 8 }}>
              {t("feedbackClose")}
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 14, fontSize: 14 }}>
              {t("feedbackSubtitle")}
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("feedbackPlaceholder")}
              rows={5}
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1.5px solid var(--border)",
                borderRadius: 6,
                marginBottom: 10,
                fontSize: 14,
                background: "var(--bg-input)",
                color: "var(--text)",
                fontFamily: "inherit",
              }}
            />
            <label>{t("feedbackEmailLabel")}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={submitting} style={{ width: "100%" }}>
              {submitting ? t("feedbackSending") : t("feedbackSend")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
