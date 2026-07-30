"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

type ServiceRow = { name: string; basePrice: number };
type PlanKey = "weekly" | "biweekly" | "monthly" | "one_time";
type MowingEstimate = { sqft: number; total: number | null; overgrownFee: number; needsManualQuote: boolean };
type AvailabilityDay = { date: string; count: number; times: string[] };

const RECURRING_PLANS: { key: PlanKey; label: string; note: string; basePrice: number; badge?: string }[] = [
  { key: "weekly", label: "Weekly", note: "Always sharp, free priority slot", basePrice: 40, badge: "BEST VALUE" },
  { key: "biweekly", label: "Bi-Weekly", note: "Every other week, most popular", basePrice: 50 },
];
const AS_NEEDED_PLANS: { key: PlanKey; label: string; note: string; basePrice: number }[] = [
  { key: "monthly", label: "Monthly", note: "Low-maintenance lots", basePrice: 85 },
  { key: "one_time", label: "One-Time", note: "No commitment, no slot held", basePrice: 100 },
];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(monthDate: Date): (Date | null)[][] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function BookPage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [mowingEstimate, setMowingEstimate] = useState<MowingEstimate | null>(null);
  const [grassHeightIn, setGrassHeightIn] = useState("");
  const [plan, setPlan] = useState<PlanKey | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const polygonRef = useRef<any>(null);

  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then(setServices);

    fetch("/api/bookings/availability")
      .then((r) => r.json())
      .then((data) => setAvailability(data.days ?? []));
  }, []);

  function toggleService(name: string) {
    setSelectedServices((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
    if (name === "Mowing") {
      setShowMap(false);
      setMowingEstimate(null);
      setPlan(null);
    }
  }

  const estimatedTotal = services
    .filter((s) => selectedServices.includes(s.name))
    .reduce((sum, s) => {
      if (s.name === "Mowing" && mowingEstimate) return sum + (mowingEstimate.total ?? s.basePrice);
      return sum + s.basePrice;
    }, 0);

  async function getLawnEstimate() {
    if (!address) {
      setMapError("Enter your address first.");
      return;
    }
    setMapError(null);
    setMowingEstimate(null);
    setMapLoading(true);
    try {
      const res = await fetch("/api/estimate/mowing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMapError(data.error ?? "Could not locate that address.");
        return;
      }
      setShowMap(true);
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setMapError("Google Maps isn't configured yet.");
        return;
      }
      await loadGoogleMaps(apiKey);
      initMap(data.location);
    } catch {
      setMapError("Something went wrong loading the map.");
    } finally {
      setMapLoading(false);
    }
  }

  function initMap(location: { lat: number; lng: number }) {
    if (!mapRef.current) return;
    const google = window.google;
    const map = new google.maps.Map(mapRef.current, {
      center: location,
      zoom: 20,
      mapTypeId: "satellite",
    });
    const polygon = new google.maps.Polygon({
      map,
      path: [],
      editable: true,
      fillColor: "#34d67f",
      fillOpacity: 0.3,
      strokeColor: "#34d67f",
      strokeWeight: 2,
    });
    polygonRef.current = polygon;
    setPointCount(0);

    map.addListener("click", (e: any) => {
      const path = polygon.getPath();
      path.push(e.latLng);
      setPointCount(path.getLength());
    });
  }

  function finishMeasuring() {
    const google = window.google;
    const polygon = polygonRef.current;
    if (!polygon || polygon.getPath().getLength() < 3) {
      setMapError("Click at least 3 points to outline your lawn.");
      return;
    }
    const areaSqM = google.maps.geometry.spherical.computeArea(polygon.getPath());
    const areaSqFt = areaSqM * 10.7639;
    computeMowingEstimate(areaSqFt);
  }

  function clearLawnBoundary() {
    polygonRef.current?.getPath().clear();
    setPointCount(0);
    setMapError(null);
  }

  async function computeMowingEstimate(areaSqFt: number) {
    const res = await fetch("/api/estimate/mowing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        polygonAreaSqFt: areaSqFt,
        grassHeightIn: grassHeightIn ? Number(grassHeightIn) : undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setMowingEstimate({
        sqft: data.sqft,
        total: data.total,
        overgrownFee: data.overgrownFee,
        needsManualQuote: data.needsManualQuote,
      });
    } else {
      setMapError(data.error ?? "Could not price that lawn.");
    }
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    if (selectedServices.length === 0) {
      setStatus("Please select at least one service.");
      return;
    }
    setIsSubmitting(true);
    setStatus("Booking...");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          services: selectedServices,
          planFrequency: plan ?? undefined,
          address,
          scheduledFor: new Date(`${date}T${time}`).toISOString(),
          isEmergency,
        }),
      });
      if (res.ok) {
        setStatus("✓ Booked! Confirmation sent to " + email);
      } else {
        const err = await res.json();
        setStatus("Error: " + JSON.stringify(err.error));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const sizeMultiplier = mowingEstimate ? mowingEstimate.sqft / 3000 : 1;
  const mowingSelected = selectedServices.includes("Mowing");

  return (
    <main>
      <div className="card">
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>
          Your lawn, <span className="accent">handled.</span>
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: -4 }}>
          Professional mowing, edging & trim for homes right in your neighborhood.
        </p>
        <h2 style={{ marginTop: 24, fontSize: 18 }}>Book an appointment</h2>
        <form onSubmit={submitBooking}>
          <label>Services</label>
          {services.map((s) => (
            <label key={s.name} style={{ display: "block", fontWeight: "normal" }}>
              <input
                type="checkbox"
                style={{ width: "auto", marginRight: 8 }}
                checked={selectedServices.includes(s.name)}
                onChange={() => toggleService(s.name)}
              />
              {s.name} — starting at ${s.basePrice}
            </label>
          ))}
          {selectedServices.length > 0 && <p>Estimated total: ${estimatedTotal}</p>}

          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />

          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label>Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} required />

          {mowingSelected && (
            <div style={{ marginTop: -4, marginBottom: 16 }}>
              {!mowingEstimate && (
                <>
                  <label style={{ fontWeight: "normal", fontSize: 13 }}>
                    Grass height, if overgrown (inches) — optional
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g. 8"
                    value={grassHeightIn}
                    onChange={(e) => setGrassHeightIn(e.target.value)}
                    style={{ maxWidth: 120 }}
                  />
                  <button type="button" onClick={getLawnEstimate} disabled={mapLoading}>
                    {mapLoading ? "Loading map..." : "Measure my lawn for an exact mowing price"}
                  </button>
                </>
              )}
              {mapError && <p style={{ color: "var(--gold)" }}>{mapError}</p>}
              {showMap && !mowingEstimate && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    Click points around your lawn's edges to outline it ({pointCount} point
                    {pointCount === 1 ? "" : "s"} placed).
                  </p>
                  <div
                    ref={mapRef}
                    style={{ height: 400, width: "100%", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 10 }}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={finishMeasuring} disabled={pointCount < 3}>
                      Finish measuring
                    </button>
                    <button type="button" onClick={clearLawnBoundary} disabled={pointCount === 0}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
              {mowingEstimate && mowingEstimate.needsManualQuote && (
                <p className="accent">
                  Lawn measured: {mowingEstimate.sqft.toLocaleString()} sq ft. Grass over 10in is priced by
                  hand — we'll follow up with a custom quote before your appointment.
                </p>
              )}
              {mowingEstimate && !mowingEstimate.needsManualQuote && (
                <p className="accent">
                  Lawn measured: {mowingEstimate.sqft.toLocaleString()} sq ft — mowing price: $
                  {mowingEstimate.total}
                  {mowingEstimate.overgrownFee > 0 && ` (includes $${mowingEstimate.overgrownFee} overgrown fee)`}
                </p>
              )}
            </div>
          )}

          {mowingEstimate && (
            <>
              <p className="brand-label" style={{ textAlign: "center", marginTop: 8 }}>
                — Service Plans —
              </p>

              <p className="brand-label" style={{ marginBottom: 8 }}>
                Recurring care — lowest cost
              </p>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                {RECURRING_PLANS.map((p) => (
                  <label
                    key={p.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontWeight: "normal",
                      padding: "8px 4px",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="radio"
                        name="plan"
                        style={{ width: "auto", margin: 0 }}
                        checked={plan === p.key}
                        onChange={() => setPlan(p.key)}
                      />
                      <span>
                        <strong>{p.label}</strong>
                        {p.badge && (
                          <span className="accent" style={{ fontSize: 11, fontWeight: 700, marginLeft: 8 }}>
                            {p.badge}
                          </span>
                        )}
                        <br />
                        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{p.note}</span>
                      </span>
                    </span>
                    <span className="accent" style={{ fontWeight: 700 }}>
                      ${Math.round(p.basePrice * sizeMultiplier)}
                      <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/visit</span>
                    </span>
                  </label>
                ))}
              </div>

              <p className="brand-label" style={{ marginBottom: 8 }}>
                As-needed — premium rate
              </p>
              <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: 12, marginBottom: 24 }}>
                {AS_NEEDED_PLANS.map((p) => (
                  <label
                    key={p.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontWeight: "normal",
                      padding: "8px 4px",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="radio"
                        name="plan"
                        style={{ width: "auto", margin: 0 }}
                        checked={plan === p.key}
                        onChange={() => setPlan(p.key)}
                      />
                      <span>
                        <strong>{p.label}</strong>
                        <br />
                        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{p.note}</span>
                      </span>
                    </span>
                    <span style={{ fontWeight: 700 }}>
                      ${Math.round(p.basePrice * sizeMultiplier)}
                      <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/visit</span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          <label>Date</label>
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
                }
              >
                ‹
              </button>
              <strong>
                {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </strong>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
                }
              >
                ›
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 4,
                fontSize: 11,
                textAlign: "center",
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            {buildMonthGrid(calendarMonth).map((week, wi) => (
              <div
                key={wi}
                style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}
              >
                {week.map((day, di) => {
                  if (!day) return <div key={di} />;
                  const key = toDateKey(day);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isPast = day < today;
                  const dayAvailability = availability.find((a) => a.date === key);
                  const isSelected = date === key;
                  return (
                    <button
                      key={di}
                      type="button"
                      disabled={isPast}
                      onClick={() => setDate(key)}
                      style={{
                        padding: "6px 2px",
                        borderRadius: 6,
                        border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                        background: isSelected ? "rgba(52,214,127,0.15)" : "var(--bg-input)",
                        color: "var(--text)",
                        cursor: isPast ? "not-allowed" : "pointer",
                        fontSize: 12,
                        opacity: isPast ? 0.35 : 1,
                        fontWeight: 400,
                      }}
                    >
                      <div>{day.getDate()}</div>
                      {dayAvailability && (
                        <div style={{ fontSize: 9, color: "var(--gold)" }}>{dayAvailability.count} booked</div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            {date &&
              (() => {
                const selected = availability.find((a) => a.date === date);
                return (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10, marginBottom: 0 }}>
                    Selected:{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </strong>
                    {selected
                      ? ` — ${selected.count} other booking${selected.count === 1 ? "" : "s"} that day at ${selected.times.join(", ")}. You can still book this day.`
                      : " — no other bookings that day yet."}
                  </p>
                );
              })()}
          </div>

          <label>Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />

          <label>
            <input
              type="checkbox"
              style={{ width: "auto", marginRight: 8 }}
              checked={isEmergency}
              onChange={(e) => setIsEmergency(e.target.checked)}
            />
            Emergency appointment (+$15 rush fee)
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Booking..." : "Confirm appointment"}
          </button>
        </form>
        {status && <p>{status}</p>}
      </div>
    </main>
  );
}
