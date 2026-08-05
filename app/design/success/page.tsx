"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/app/components/LanguageProvider";
import MediaLightbox, { LightboxItem } from "@/app/components/MediaLightbox";

type QuoteRequest = {
  id: string;
  status: string;
  conceptUrls: string[];
  conceptVideoUrls: string[];
  conceptMaterials: string[];
  conceptCount: number;
  tier: string;
  amountPaid: number;
};

function DesignSuccessContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const quoteRequestId = searchParams.get("qr");
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const [loggedIn, setLoggedIn] = useState(false);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());
  const [lightboxKind, setLightboxKind] = useState<"images" | "videos" | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!quoteRequestId) {
      setError(t("missingQuoteRequest"));
      return;
    }
    fetch("/api/quote/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteRequestId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? t("designGenerationError"));
          return;
        }
        setQuote(data);
      })
      .catch(() => setError(t("designGenerationError")));

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((session) => {
        setLoggedIn(!!session?.loggedIn);
        if (session?.loggedIn) {
          fetch("/api/design/save")
            .then((r) => r.json())
            .then((items) => Array.isArray(items) && setSavedUrls(new Set(items.map((i: any) => i.mediaUrl))));
        }
      })
      .catch(() => {});
  }, [quoteRequestId]);

  async function toggleSave(mediaUrl: string) {
    if (!quote) return;
    const isSaved = savedUrls.has(mediaUrl);
    setSavedUrls((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(mediaUrl) : next.add(mediaUrl);
      return next;
    });
    if (isSaved) {
      await fetch("/api/design/save", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl }),
      });
    } else {
      await fetch("/api/design/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteRequestId: quote.id, mediaUrl }),
      });
    }
  }

  async function regenerate() {
    if (!quote) return;
    setRegenerateError(null);
    setRegenerating(true);
    try {
      const res = await fetch("/api/design/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteRequestId: quote.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegenerateError(data.error ?? t("designGenerationError"));
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        window.location.href = `/design/success?qr=${data.quoteRequestId}`;
      }
    } catch {
      setRegenerateError(t("designGenerationError"));
      setRegenerating(false);
    }
  }

  const imageItems: LightboxItem[] = (quote?.conceptUrls ?? []).map((url) => ({ url, isVideo: false }));
  const videoItems: LightboxItem[] = (quote?.conceptVideoUrls ?? []).map((url) => ({ url, isVideo: true }));
  const activeItems = lightboxKind === "images" ? imageItems : lightboxKind === "videos" ? videoItems : null;

  return (
    <main>
      <div className="card">
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>{t("yourDesignConcepts")}</h1>

        {error && <p style={{ color: "var(--gold)" }}>{error}</p>}

        {!error && !quote && (
          <p style={{ color: "var(--text-muted)" }}>{t("generatingDesigns")}</p>
        )}

        {quote && quote.conceptUrls.length > 0 && (
          <>
            <p className="accent">
              ✓ {quote.conceptUrls.length} {t("designConceptsReady")}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: -4 }}>{t("swipeHint")}</p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 12,
                marginTop: 12,
              }}
            >
              {quote.conceptUrls.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => {
                    setLightboxKind("images");
                    setLightboxIndex(i);
                  }}
                  style={{ padding: 0, background: "transparent" }}
                >
                  <img
                    src={url}
                    alt="Design concept"
                    style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
                  />
                </button>
              ))}
            </div>

            {quote.conceptVideoUrls.length > 0 && (
              <>
                <p className="accent" style={{ marginTop: 24 }}>
                  ▶ {t("designVideosReady")}
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 12,
                    marginTop: 12,
                  }}
                >
                  {quote.conceptVideoUrls.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => {
                        setLightboxKind("videos");
                        setLightboxIndex(i);
                      }}
                      style={{ padding: 0, background: "transparent" }}
                    >
                      <video
                        src={url}
                        style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", pointerEvents: "none" }}
                        muted
                      />
                    </button>
                  ))}
                </div>
              </>
            )}

            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 16 }}>
              {t("designChangesNote")}
            </p>

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 10 }}>
                {t("regenerateNote")}
              </p>
              <button type="button" onClick={regenerate} disabled={regenerating}>
                {regenerating
                  ? t("regenerateSending")
                  : quote.amountPaid === 0
                    ? t("regenerateFreeBtn")
                    : t("regeneratePaidBtn")}
              </button>
              {regenerateError && (
                <p style={{ color: "var(--gold)", marginTop: 8 }}>{regenerateError}</p>
              )}
            </div>
          </>
        )}
      </div>

      {activeItems && (
        <MediaLightbox
          items={activeItems}
          startIndex={lightboxIndex}
          onClose={() => setLightboxKind(null)}
          renderExtra={(item, index) => {
            const materials = quote?.conceptMaterials?.[index];
            return (
              <>
                {materials && (
                  <p
                    style={{
                      color: "#e0e6e2",
                      fontSize: 13,
                      maxWidth: 480,
                      textAlign: "center",
                      margin: 0,
                    }}
                  >
                    <strong style={{ color: "#fff" }}>{t("materialsUsedLabel")}: </strong>
                    {materials}
                  </p>
                )}
                {loggedIn && (
                  <button type="button" onClick={() => toggleSave(item.url)} style={{ padding: "8px 16px" }}>
                    {savedUrls.has(item.url) ? `★ ${t("savedBtn")}` : `☆ ${t("saveBtn")}`}
                  </button>
                )}
              </>
            );
          }}
        />
      )}
    </main>
  );
}

export default function DesignSuccessPage() {
  return (
    <Suspense
      fallback={
        <main>
          <div className="card">
            <p className="brand-label">Verdant Lawn Care</p>
            <h1>Your design concepts</h1>
            <p style={{ color: "var(--text-muted)" }}>Loading...</p>
          </div>
        </main>
      }
    >
      <DesignSuccessContent />
    </Suspense>
  );
}
