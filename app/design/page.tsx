"use client";
import { useRef, useState } from "react";
import { DESIGN_TIERS, DesignTierKey } from "@/lib/designTiers";
import { useLanguage } from "@/app/components/LanguageProvider";
import type { DictKey } from "@/lib/i18n";
import FilePreviewStrip from "@/app/components/FilePreviewStrip";

const TIER_LABEL_KEYS: Record<DesignTierKey, DictKey> = {
  standard: "designTierLabelStandard",
  better: "designTierLabelBetter",
  highest: "designTierLabelHighest",
};
const TIER_NOTE_KEYS: Record<DesignTierKey, DictKey> = {
  standard: "designTierNoteStandard",
  better: "designTierNoteBetter",
  highest: "designTierNoteHighest",
};

export default function DesignPage() {
  const { t } = useLanguage();
  const [tier, setTier] = useState<DesignTierKey>("standard");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  async function startCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const photoFiles = files.filter((f) => f.type.startsWith("image/"));
    if (photoFiles.length === 0) {
      setError(t("attachAtLeastOnePhoto"));
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      for (const f of files) formData.append("files", f);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        setError(err.error ?? t("couldNotUploadPhotos"));
        return;
      }
      const { urls } = await uploadRes.json();

      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          customerName: name,
          customerEmail: email,
          photoUrls: urls,
          description,
        }),
      });
      if (!checkoutRes.ok) {
        const err = await checkoutRes.json();
        setError(err.error ?? t("couldNotStartCheckout"));
        return;
      }
      const { checkoutUrl } = await checkoutRes.json();
      window.location.href = checkoutUrl;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <div className="card">
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>{t("designPageTitle")}</h1>
        <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 20 }}>
          {t("designPageSubtitle")}
        </p>

        <form onSubmit={startCheckout}>
          <label>{t("packageLabel")}</label>
          {(Object.keys(DESIGN_TIERS) as DesignTierKey[]).map((key) => {
            const tierInfo = DESIGN_TIERS[key];
            const tierLabelKey = TIER_LABEL_KEYS[key];
            const tierNoteKey = TIER_NOTE_KEYS[key];
            return (
              <label
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontWeight: "normal",
                  border: tier === key ? "2px solid var(--accent)" : "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="radio"
                    name="tier"
                    style={{ width: "auto", margin: 0 }}
                    checked={tier === key}
                    onChange={() => setTier(key)}
                  />
                  <span>
                    <strong>{t(tierLabelKey)}</strong>
                    <br />
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{t(tierNoteKey)}</span>
                  </span>
                </span>
                <span className="accent" style={{ fontWeight: 700 }}>
                  ${tierInfo.price}
                </span>
              </label>
            );
          })}

          <label>{t("nameLabel")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />

          <label>{t("emailLabel")}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label>{t("describeWhatYouWant")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("describePlaceholder")}
            rows={4}
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1.5px solid var(--border)",
              borderRadius: 6,
              marginBottom: 14,
              fontSize: 14,
              background: "var(--bg-input)",
              color: "var(--text)",
              fontFamily: "inherit",
            }}
          />

          <label>{t("photosVideosLabel")}</label>
          <FilePreviewStrip files={files} onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))} />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((prev) => [...prev, ...picked]);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((prev) => [...prev, ...picked]);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((prev) => [...prev, ...picked]);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button type="button" onClick={() => photoInputRef.current?.click()} aria-label={t("chatCameraAria")}>
              📷
            </button>
            <button type="button" onClick={() => videoInputRef.current?.click()} aria-label={t("chatVideoAria")}>
              🎥
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} aria-label={t("chatAttachAria")}>
              📎
            </button>
          </div>
          {files.length > 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {files.length} {t("filesSelected")}
            </p>
          )}

          {error && <p style={{ color: "var(--gold)" }}>{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? t("preparingCheckoutBtn") : `${t("continueToPaymentBtn")} — $${DESIGN_TIERS[tier].price}`}
          </button>
        </form>
      </div>
    </main>
  );
}
