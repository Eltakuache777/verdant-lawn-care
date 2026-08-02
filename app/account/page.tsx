"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageProvider";
import { RECURRING_FREQUENCIES } from "@/lib/recurringFrequency";
import type { DictKey } from "@/lib/i18n";

type RecurringPlan = { services: string[]; frequency: string; pricePerVisit: number; nextDate: string; active: boolean };

const FREQUENCY_KEYS: Record<string, DictKey> = {
  weekly: "freqWeekly",
  biweekly: "freqBiweekly",
  every_3_weeks: "freqEvery3Weeks",
  monthly: "freqMonthly",
};

export default function AccountPage() {
  const { t, lang } = useLanguage();
  const [plan, setPlan] = useState<RecurringPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState("biweekly");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/my/recurring-plan")
      .then((r) => r.json())
      .then((data) => {
        if (data?.recurringPlan) {
          setPlan(data.recurringPlan);
          setFrequency(data.recurringPlan.frequency);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveFrequency(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setSaving(true);
    try {
      const res = await fetch("/api/my/recurring-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlan((prev) => (prev ? { ...prev, frequency: updated.frequency } : prev));
        setStatus(t("frequencyUpdated"));
      } else {
        setStatus(t("couldNotUpdateFrequency"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <div className="card">
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>{t("accountPageTitle")}</h1>

        {loading && <p style={{ color: "var(--text-muted)" }}>Loading...</p>}

        {!loading && !plan && <p style={{ color: "var(--text-muted)" }}>{t("noRecurringPlanYet")}</p>}

        {!loading && plan && (
          <>
            <h3 style={{ marginTop: 0 }}>{t("yourPlanHeading")}</h3>
            <p style={{ margin: "4px 0" }}>
              {plan.services.join(", ")} — <strong className="accent">${plan.pricePerVisit}</strong>{" "}
              {t("pricePerVisitLabel").toLowerCase()}
            </p>
            <p style={{ margin: "4px 0", color: "var(--text-muted)", fontSize: 13 }}>
              {t("nextVisitLabel")}:{" "}
              {new Date(plan.nextDate).toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { timeZone: "UTC" })}
            </p>

            <form onSubmit={saveFrequency} style={{ marginTop: 16 }}>
              <label>{t("howOftenLabel")}</label>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                {RECURRING_FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {t(FREQUENCY_KEYS[f.value])}
                  </option>
                ))}
              </select>
              {status && <p style={{ fontSize: 13 }}>{status}</p>}
              <button type="submit" disabled={saving}>
                {saving ? t("savingBtn") : t("saveFrequencyBtn")}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
