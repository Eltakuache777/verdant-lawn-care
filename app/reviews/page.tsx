"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageProvider";

type ServiceRow = { name: string; basePrice: number };
type ReviewRow = { id: string; customerName: string; rating: number; comment: string; service: string | null; createdAt: string };
type Session = { loggedIn: boolean; role?: "admin" | "worker" | "customer" };

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 1, color: "var(--gold)" }}>
      {"★".repeat(rating)}
      <span style={{ color: "var(--border)" }}>{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function ReviewsPage() {
  const { t } = useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [service, setService] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  const isCustomer = session?.loggedIn && session.role === "customer";
  const isAdmin = session?.loggedIn && session.role === "admin";

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession({ loggedIn: false }));
    fetch("/api/services")
      .then((r) => r.json())
      .then(setServices);
    loadReviews();
  }, []);

  function loadReviews() {
    setLoading(true);
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((data) => {
        setReviews(data.reviews ?? []);
        setAverage(data.average ?? 0);
        setCount(data.count ?? 0);
      })
      .finally(() => setLoading(false));
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim(), service: service || undefined }),
      });
      if (!res.ok) {
        setSubmitError(t("reviewsSubmitError"));
        return;
      }
      setThanks(true);
      setComment("");
      setService("");
      setRating(5);
      loadReviews();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteReview(id: string) {
    if (!confirm(t("reviewsConfirmDelete"))) return;
    setReviews((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/reviews/${id}`, { method: "DELETE" });
  }

  const averageLabelKey = count === 1 ? "reviewsAverageLabel" : "reviewsAverageLabelPlural";

  return (
    <main>
      <div className="card" style={{ maxWidth: 700 }}>
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>{t("reviewsTitle")}</h1>
        <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 16 }}>{t("reviewsSubtitle")}</p>

        {count > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <Stars rating={Math.round(average)} size={22} />
            <span style={{ color: "var(--text)", fontWeight: 700 }}>{average.toFixed(1)}</span>
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {t(averageLabelKey, { count: String(count) })}
            </span>
          </div>
        )}

        {!showForm && !thanks && (
          <>
            {isCustomer ? (
              <button type="button" onClick={() => setShowForm(true)} style={{ marginBottom: 24 }}>
                {t("reviewsLeaveButton")}
              </button>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>{t("reviewsLoginPrompt")}</p>
            )}
          </>
        )}

        {showForm && !thanks && (
          <form
            onSubmit={submitReview}
            style={{
              border: "1px solid var(--accent)",
              background: "rgba(52,214,127,0.06)",
              borderRadius: 10,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <label>{t("reviewsRatingLabel")}</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  style={{
                    background: "transparent",
                    padding: "4px 6px",
                    fontSize: 24,
                    color: n <= rating ? "var(--gold)" : "var(--border)",
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            <label>{t("reviewsServiceLabel")}</label>
            <select value={service} onChange={(e) => setService(e.target.value)}>
              <option value="">{t("reviewsServicePlaceholder")}</option>
              {services.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>

            <label>{t("reviewsCommentLabel")}</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("reviewsCommentPlaceholder")}
              rows={4}
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

            {submitError && <p style={{ color: "var(--gold)" }}>{submitError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={submitting}>
                {submitting ? t("reviewsSubmitting") : t("reviewsSubmitBtn")}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ background: "transparent", color: "var(--text-muted)" }}
              >
                {t("reviewsCancelBtn")}
              </button>
            </div>
          </form>
        )}

        {thanks && (
          <div
            style={{
              border: "1px solid var(--accent)",
              background: "rgba(52,214,127,0.06)",
              borderRadius: 10,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <p className="accent" style={{ margin: 0 }}>
              {t("reviewsThanks")}
            </p>
          </div>
        )}

        {loading && <p style={{ color: "var(--text-muted)" }}>{t("reviewsLoading")}</p>}
        {!loading && reviews.length === 0 && <p style={{ color: "var(--text-muted)" }}>{t("reviewsEmpty")}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ position: "relative", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => deleteReview(r.id)}
                  aria-label="Delete"
                  title="Delete"
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 22,
                    height: 22,
                    padding: 0,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.5)",
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Stars rating={r.rating} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{r.customerName}</span>
                {r.service && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {r.service}</span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "var(--text)" }}>{r.comment}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
