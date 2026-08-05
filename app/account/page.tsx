"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageProvider";
import { RECURRING_FREQUENCIES, SERVICE_FREQUENCY_VALUES } from "@/lib/recurringFrequency";
import { toDateKey, buildMonthGrid } from "@/lib/calendarGrid";
import type { DictKey } from "@/lib/i18n";

type RecurringPlan = { services: string[]; frequency: string; pricePerVisit: number; nextDate: string; active: boolean };
type MyBooking = {
  id: string;
  services: string[];
  address: string;
  scheduledFor: string;
  status: string;
  totalPrice: number;
  amountPaid: number | null;
  assignedWorkerName: string | null;
};
type MyDesign = {
  id: string;
  tier: string;
  conceptCount: number;
  conceptUrls: string[];
  conceptVideoUrls: string[];
  description: string | null;
  createdAt: string;
};

const FREQUENCY_KEYS: Record<string, DictKey> = {
  weekly: "freqWeekly",
  biweekly: "freqBiweekly",
  every_3_weeks: "freqEvery3Weeks",
  monthly: "freqMonthly",
  bimonthly: "freqBimonthly",
};

export default function AccountPage() {
  const { t, lang } = useLanguage();
  const dateLocale = lang === "es" ? "es-ES" : "en-US";

  const [plan, setPlan] = useState<RecurringPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [frequency, setFrequency] = useState("biweekly");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [mowingFrequency, setMowingFrequency] = useState("");
  const [binFrequency, setBinFrequency] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsStatus, setPrefsStatus] = useState<string | null>(null);

  const [address, setAddress] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressStatus, setAddressStatus] = useState<string | null>(null);

  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string>(() => toDateKey(new Date()));

  const [designs, setDesigns] = useState<MyDesign[]>([]);

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

    fetch("/api/my/service-frequencies")
      .then((r) => r.json())
      .then((data) => {
        setMowingFrequency(data?.mowingFrequency || "");
        setBinFrequency(data?.binCleaningFrequency || "");
      });

    fetch("/api/my/profile")
      .then((r) => r.json())
      .then((data) => setAddress(data?.address || ""));

    fetch("/api/my/bookings")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setBookings(data));

    fetch("/api/my/designs")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setDesigns(data));
  }, []);

  async function savePreferences(e: React.FormEvent) {
    e.preventDefault();
    setPrefsStatus(null);
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/my/service-frequencies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mowingFrequency: mowingFrequency || null,
          binCleaningFrequency: binFrequency || null,
        }),
      });
      setPrefsStatus(res.ok ? t("preferencesSaved") : t("couldNotUpdateFrequency"));
    } finally {
      setSavingPrefs(false);
    }
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setAddressStatus(null);
    setSavingAddress(true);
    try {
      const res = await fetch("/api/my/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      setAddressStatus(res.ok ? t("addressSaved") : t("couldNotUpdateFrequency"));
    } finally {
      setSavingAddress(false);
    }
  }

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

  const bookingsByDay = new Map<string, MyBooking[]>();
  for (const b of bookings) {
    const key = toDateKey(new Date(b.scheduledFor));
    bookingsByDay.set(key, [...(bookingsByDay.get(key) ?? []), b]);
  }
  const selectedDayBookings = bookingsByDay.get(selectedDay) ?? [];

  return (
    <main>
      <div className="card">
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>{t("accountPageTitle")}</h1>

        {loading && <p style={{ color: "var(--text-muted)" }}>Loading...</p>}

        {!loading && (
          <>
            <h3 style={{ marginTop: 0 }}>{t("yourInfoHeading")}</h3>
            <form onSubmit={saveAddress}>
              <label>{t("savedAddressLabel")}</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("addressLabel")} />
              {addressStatus && <p style={{ fontSize: 13 }}>{addressStatus}</p>}
              <button type="submit" disabled={savingAddress}>
                {savingAddress ? t("savingBtn") : t("saveAddressBtn")}
              </button>
            </form>

            <h3 style={{ marginTop: 24 }}>{t("servicePreferencesHeading")}</h3>
            <form onSubmit={savePreferences}>
              <label>{t("mowingFrequencyLabel")}</label>
              <select value={mowingFrequency} onChange={(e) => setMowingFrequency(e.target.value)}>
                <option value="">{t("noPreferenceOption")}</option>
                {SERVICE_FREQUENCY_VALUES.map((f) => (
                  <option key={f} value={f}>
                    {t(FREQUENCY_KEYS[f])}
                  </option>
                ))}
              </select>

              <label>{t("binFrequencyLabel")}</label>
              <select value={binFrequency} onChange={(e) => setBinFrequency(e.target.value)}>
                <option value="">{t("noPreferenceOption")}</option>
                {SERVICE_FREQUENCY_VALUES.map((f) => (
                  <option key={f} value={f}>
                    {t(FREQUENCY_KEYS[f])}
                  </option>
                ))}
              </select>

              {prefsStatus && <p style={{ fontSize: 13 }}>{prefsStatus}</p>}
              <button type="submit" disabled={savingPrefs}>
                {savingPrefs ? t("savingBtn") : t("savePreferencesBtn")}
              </button>
            </form>
          </>
        )}

        {!loading && !plan && (
          <p style={{ color: "var(--text-muted)", marginTop: 24 }}>{t("noRecurringPlanYet")}</p>
        )}

        {!loading && plan && (
          <>
            <h3 style={{ marginTop: 24 }}>{t("yourPlanHeading")}</h3>
            <p style={{ margin: "4px 0" }}>
              {plan.services.join(", ")} — <strong className="accent">${plan.pricePerVisit}</strong>{" "}
              {t("pricePerVisitLabel").toLowerCase()}
            </p>
            <p style={{ margin: "4px 0", color: "var(--text-muted)", fontSize: 13 }}>
              {t("nextVisitLabel")}:{" "}
              {new Date(plan.nextDate).toLocaleDateString(dateLocale, { timeZone: "UTC" })}
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

        {!loading && (
          <>
            <h3 style={{ marginTop: 24 }}>{t("yourBookingsHeading")}</h3>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <strong style={{ fontSize: 15 }}>
                {calendarMonth.toLocaleDateString(dateLocale, { month: "long", year: "numeric" })}
              </strong>
              <button
                type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              >
                ›
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 11, textAlign: "center", color: "var(--text-muted)", marginBottom: 6 }}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            {buildMonthGrid(calendarMonth).map((week, wi) => (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                {week.map((day, di) => {
                  if (!day) return <div key={di} />;
                  const key = toDateKey(day);
                  const dayBookings = bookingsByDay.get(key) ?? [];
                  const isSelected = selectedDay === key;
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => setSelectedDay(key)}
                      style={{
                        padding: "8px 2px",
                        borderRadius: 6,
                        border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: isSelected ? "rgba(52,214,127,0.15)" : "var(--bg-input)",
                        color: "var(--text)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 400,
                      }}
                    >
                      <div>{day.getDate()}</div>
                      {dayBookings.length > 0 && <div style={{ fontSize: 9, color: "var(--gold)" }}>●</div>}
                    </button>
                  );
                })}
              </div>
            ))}

            <div style={{ marginTop: 16 }}>
              <p style={{ fontWeight: 700, marginBottom: 8 }}>
                {new Date(selectedDay + "T00:00:00").toLocaleDateString(dateLocale, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {selectedDayBookings.length === 0 && (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("noBookingsThisDay")}</p>
              )}
              {selectedDayBookings.map((b) => (
                <div key={b.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    <strong className="accent">
                      {new Date(b.scheduledFor).toLocaleTimeString(dateLocale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })}
                    </strong>{" "}
                    — {b.services.join(", ")}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{b.address}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    ${b.totalPrice} —{" "}
                    <span style={{ color: b.status === "completed" ? "var(--accent)" : "var(--text-muted)" }}>
                      {b.status === "completed" ? `✓ ${t("bookingStatusCompleted")}` : b.status}
                    </span>
                    {b.assignedWorkerName ? ` — ${b.assignedWorkerName}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && (
          <>
            <h3 style={{ marginTop: 24 }}>{t("myDesignsHeading")}</h3>
            {designs.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("noDesignsYet")}</p>
            )}
            {designs.map((d) => (
              <a
                key={d.id}
                href={`/design/success?qr=${d.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 8,
                  textDecoration: "none",
                  color: "var(--text)",
                }}
              >
                {d.conceptUrls[0] && (
                  <img
                    src={d.conceptUrls[0]}
                    alt=""
                    style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                    {new Date(d.createdAt).toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    {d.conceptUrls.length} {t("designConceptsReady")}
                    {d.conceptVideoUrls.length > 0 ? ` · ${d.conceptVideoUrls.length} ${t("designVideosReady")}` : ""}
                  </p>
                </div>
              </a>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
