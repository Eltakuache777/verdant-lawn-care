"use client";
import { useLanguage } from "./LanguageProvider";
import { LANGUAGES } from "@/lib/i18n";

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

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
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
      <a href="/estimate/fence" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        {t("navFence")}
      </a>
      <a href="/estimate/pressure" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        {t("navPressure")}
      </a>
      <a href="/materials" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        {t("navMaterials")}
      </a>
      <a href="/design" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        {t("navDesign")}
      </a>
      <a href="/worker" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        {t("navWorker")}
      </a>
      <a href="/admin" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
        {t("navAdmin")}
      </a>

      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as "en" | "es")}
        aria-label="Language"
        style={{
          marginLeft: "auto",
          width: "auto",
          marginBottom: 0,
          padding: "6px 10px",
          fontSize: 13,
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
