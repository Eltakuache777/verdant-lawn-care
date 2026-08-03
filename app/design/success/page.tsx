"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/app/components/LanguageProvider";

type QuoteRequest = {
  id: string;
  status: string;
  conceptUrls: string[];
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
  }, [quoteRequestId]);

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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 12,
                marginTop: 16,
              }}
            >
              {quote.conceptUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt="Design concept"
                    style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
                  />
                </a>
              ))}
            </div>

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
