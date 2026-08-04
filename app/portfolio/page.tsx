"use client";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/app/components/LanguageProvider";
import FilePreviewStrip from "@/app/components/FilePreviewStrip";

type ServiceRow = { name: string; basePrice: number };
type PortfolioItemRow = { id: string; service: string; mediaUrl: string; caption: string | null; createdAt: string };
type Session = { loggedIn: boolean; role?: "admin" | "worker" | "customer" };

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)$/i.test(url);
}

// Fallback background colors for a service card before any photo has been
// uploaded for it yet — cycles through so each service looks distinct.
const FALLBACK_COLORS = ["#2d4a6b", "#6b3d2d", "#4a4030", "#2d5a4a", "#4a2d5a", "#5a2d3d"];

export default function PortfolioPage() {
  const { t } = useLanguage();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<PortfolioItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const items = selectedService ? allItems.filter((i) => i.service === selectedService) : [];
  const countFor = (name: string) => allItems.filter((i) => i.service === name).length;
  const coverFor = (name: string) => allItems.find((i) => i.service === name && !isVideoUrl(i.mediaUrl))?.mediaUrl;

  // Staff-only upload state
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const isStaff = session?.loggedIn && (session.role === "admin" || session.role === "worker");
  const isAdmin = session?.loggedIn && session.role === "admin";

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then(setServices);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession({ loggedIn: false }));
  }, []);

  useEffect(() => {
    loadItems();
  }, []);

  function loadItems() {
    setLoading(true);
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then(setAllItems)
      .finally(() => setLoading(false));
  }

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService) return;
    if (files.length === 0) {
      setUploadError(t("portfolioAttachAtLeastOne"));
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      for (const f of files) formData.append("files", f);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        setUploadError(err.error ?? t("couldNotUpload"));
        return;
      }
      const { urls } = await uploadRes.json();
      for (const mediaUrl of urls) {
        await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service: selectedService, mediaUrl, caption: caption.trim() || undefined }),
        });
      }
      setFiles([]);
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadItems();
    } finally {
      setUploading(false);
    }
  }

  async function deleteItem(id: string) {
    if (!confirm(t("portfolioConfirmDelete"))) return;
    setAllItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
  }

  return (
    <main>
      <div className="card" style={{ maxWidth: 700 }}>
        <p className="brand-label">Verdant Lawn Care</p>

        {!selectedService ? (
          <>
            <h1>{t("portfolioTitle")}</h1>
            <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 20 }}>{t("portfolioSubtitle")}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {services.map((s, i) => {
                const cover = coverFor(s.name);
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setSelectedService(s.name)}
                    style={{
                      position: "relative",
                      height: 130,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      overflow: "hidden",
                      padding: 0,
                      background: cover
                        ? `url(${cover}) center/cover no-repeat`
                        : FALLBACK_COLORS[i % FALLBACK_COLORS.length],
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.75) 100%)",
                      }}
                    />
                    <div style={{ position: "absolute", left: 16, right: 16, bottom: 12 }}>
                      <div style={{ color: "#fff", fontWeight: 800, fontSize: 18, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                        {s.name}
                      </div>
                      <div style={{ color: "#e0e6e2", fontSize: 12, marginTop: 2 }}>
                        {countFor(s.name)} {countFor(s.name) === 1 ? t("portfolioItemSingular") : t("portfolioItemPlural")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSelectedService(null)}
              style={{ background: "transparent", color: "var(--text-muted)", padding: "4px 0", fontWeight: 600, marginBottom: 12 }}
            >
              ← {t("portfolioBackToServices")}
            </button>
            <h1>{selectedService}</h1>
            <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 20 }}>{t("portfolioSubtitle")}</p>

            {isStaff && (
              <div
                style={{
                  border: "1px solid var(--accent)",
                  background: "rgba(52,214,127,0.06)",
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 24,
                }}
              >
                <p className="accent" style={{ fontWeight: 700, marginBottom: 10 }}>
                  {t("portfolioAddWork")}
                </p>
                <form onSubmit={submitUpload}>
                  <label style={{ fontSize: 12 }}>{t("portfolioCaptionLabel")}</label>
                  <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t("portfolioCaptionPlaceholder")} />

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

                  {uploadError && <p style={{ color: "var(--gold)" }}>{uploadError}</p>}
                  <button type="submit" disabled={uploading}>
                    {uploading ? t("portfolioUploading") : t("portfolioUploadBtn")}
                  </button>
                </form>
              </div>
            )}

            {loading && <p style={{ color: "var(--text-muted)" }}>{t("portfolioLoading")}</p>}
            {!loading && items.length === 0 && <p style={{ color: "var(--text-muted)" }}>{t("portfolioEmpty")}</p>}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 14,
              }}
            >
              {items.map((item) => (
                <div key={item.id} style={{ position: "relative" }}>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      aria-label="Delete"
                      title="Delete"
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        zIndex: 1,
                        width: 22,
                        height: 22,
                        padding: 0,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {isVideoUrl(item.mediaUrl) ? (
                    <video src={item.mediaUrl} controls style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }} />
                  ) : (
                    <a href={item.mediaUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={item.mediaUrl}
                        alt={item.caption ?? item.service}
                        style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                      />
                    </a>
                  )}
                  {item.caption && (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{item.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
