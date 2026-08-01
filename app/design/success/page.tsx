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
};

function DesignSuccessContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const quoteRequestId = searchParams.get("qr");
  const [quote, setQuote] = useState<QuoteRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

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
