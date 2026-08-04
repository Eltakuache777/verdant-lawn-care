"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { useChat } from "./ChatContext";
import { useAssistant } from "./AssistantContext";
import { useFeedback } from "./FeedbackContext";
import { LANGUAGES } from "@/lib/i18n";

type Session = { loggedIn: boolean; role?: "admin" | "worker" | "customer"; email?: string; name?: string };

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="50,8 92,88 8,88" fill="none" stroke="#f4f6f2" strokeWidth="5" />
      <polygon points="50,38 78,88 22,88" fill="#34d67f" />
    </svg>
  );
}

export default function NavBar() {
  const { lang, setLang, t } = useLanguage();
  const { toggle } = useChat();
  const { toggle: toggleAssistant } = useAssistant();
  const { toggle: toggleFeedback } = useFeedback();
  const pathname = usePathname();
  const showCustomerWidgets = !pathname?.startsWith("/admin") && !pathname?.startsWith("/worker");
  const [session, setSession] = useState<Session | null>(null);
  const [estimatesOpen, setEstimatesOpen] = useState(false);
  const estimatesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession({ loggedIn: false }));
  }, [pathname]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (estimatesRef.current && !estimatesRef.current.contains(e.target as Node)) {
        setEstimatesOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        rowGap: 10,
        columnGap: 20,
        padding: "16px 24px",
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <a
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "var(--text)",
          fontWeight: 800,
          letterSpacing: 1,
          textDecoration: "none",
          marginRight: 12,
        }}
      >
        <Logo />
        VERDANT
      </a>
      <a href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        {t("navBook")}
      </a>
      <div ref={estimatesRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setEstimatesOpen((v) => !v)}
          style={{
            background: "transparent",
            color: "var(--text-muted)",
            fontWeight: 400,
            fontSize: 16,
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {t("navEstimates")} <span style={{ fontSize: 11 }}>▾</span>
        </button>
        {estimatesOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              minWidth: 200,
              zIndex: 20,
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              overflow: "hidden",
            }}
          >
            {[
              { href: "/estimate/mowing", label: t("navMowing") },
              { href: "/estimate/fence", label: t("navFence") },
              { href: "/estimate/pressure", label: t("navPressure") },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setEstimatesOpen(false)}
                style={{
                  display: "block",
                  padding: "10px 14px",
                  color: "var(--text)",
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </div>
      <a href="/portfolio" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        {t("navPortfolio")}
      </a>
      {showCustomerWidgets && (
        <button
          type="button"
          onClick={toggle}
          style={{
            background: "transparent",
            color: "var(--text-muted)",
            fontWeight: 400,
            fontSize: 16,
            padding: 0,
          }}
        >
          💬 {t("chatButtonAria")}
        </button>
      )}
      {showCustomerWidgets && (
        <button
          type="button"
          onClick={toggleAssistant}
          style={{
            background: "transparent",
            color: "var(--text-muted)",
            fontWeight: 400,
            fontSize: 16,
            padding: 0,
          }}
        >
          🤖 {t("assistantNavLabel")}
        </button>
      )}
      {showCustomerWidgets && (
        <button
          type="button"
          onClick={toggleFeedback}
          style={{
            background: "transparent",
            color: "var(--text-muted)",
            fontWeight: 400,
            fontSize: 16,
            padding: 0,
          }}
        >
          💡 {t("feedbackTitle")}
        </button>
      )}
      <a href="/materials" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        {t("navMaterials")}
      </a>
      <a href="/design" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        {t("navDesign")}
      </a>

      {showCustomerWidgets && session?.loggedIn ? (
        <>
          <a
            href={session.role === "admin" || session.role === "worker" ? "/admin" : "/account"}
            title={session.name || session.email}
            aria-label={session.name || session.email}
            style={{
              marginLeft: "auto",
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "#06130c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            {(session.name || session.email || "?").charAt(0).toUpperCase()}
          </a>
          <button
            type="button"
            onClick={logOut}
            style={{ background: "transparent", color: "var(--text-muted)", fontWeight: 400, fontSize: 14, padding: 0 }}
          >
            Log out
          </button>
        </>
      ) : (
        showCustomerWidgets && (
          <>
            <a
              href="/login?mode=signup"
              style={{
                marginLeft: "auto",
                color: "var(--text-muted)",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              {t("navSignUp")}
            </a>
            <a
              href="/login"
              style={{
                color: "#06130c",
                background: "var(--accent)",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
                padding: "8px 14px",
                borderRadius: 6,
              }}
            >
              {t("navLogIn")}
            </a>
          </>
        )
      )}

      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as "en" | "es")}
        aria-label="Language"
        style={{
          width: "auto",
          marginBottom: 0,
          padding: "6px 10px",
          fontSize: 13,
          marginLeft: showCustomerWidgets ? 0 : "auto",
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </nav>
  );
}
