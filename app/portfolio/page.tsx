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

export default function PortfolioPage() {
  const { t } = useLanguage();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [items, setItems] = useState<PortfolioItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Staff-only upload state
  const [uploadService, setUploadService] = useState("");
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
      .then((data: ServiceRow[]) => {
        setServices(data);
        if (data.length > 0) setUploadService(data[0].name);
      });
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession({ loggedIn: false }));
  }, []);

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilter]);

  function loadItems() {
    setLoading(true);
    const query = selectedFilter === "All" ? "" : `?service=${encodeURIComponent(selectedFilter)}`;
    fetch(`/api/portfolio${query}`)
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }

  async function submitUpload(e: React.FormEvent) {
    e.preventDefault();
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
          body: JSON.stringify({ service: uploadService, mediaUrl, caption: caption.trim() || undefined }),
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
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
  }

  return (
    <main>
      <div className="card" style={{ maxWidth: 900 }}>
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>{t("portfolioTitle")}</h1>
        <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 20 }}>{t("portfolioSubtitle")}</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {["All", ...services.map((s) => s.name)].map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedFilter(name)}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                borderRadius: 20,
                background: selectedFilter === name ? "var(--accent)" : "transparent",
                color: selectedFilter === name ? "#06130c" : "var(--text-muted)",
                border: selectedFilter === name ? "1px solid var(--accent)" : "1px solid var(--border)",
                fontWeight: selectedFilter === name ? 700 : 400,
              }}
            >
              {name}
            </button>
          ))}
        </div>

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
              <label style={{ fontSize: 12 }}>{t("portfolioServiceLabel")}</label>
              <select value={uploadService} onChange={(e) => setUploadService(e.target.value)} style={{ maxWidth: 260 }}>
                {services.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>

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
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                <span className="accent" style={{ fontWeight: 700 }}>
                  {item.service}
                </span>
                {item.caption ? ` — ${item.caption}` : ""}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
