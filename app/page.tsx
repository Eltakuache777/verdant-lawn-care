"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { toDateKey, buildMonthGrid } from "@/lib/calendarGrid";
import { useLanguage } from "./components/LanguageProvider";
import AddressInput from "./components/AddressInput";
import type { DictKey } from "@/lib/i18n";
import { SERVICE_FREQUENCY_VALUES } from "@/lib/recurringFrequency";

type MyRecurringPlan = { services: string[]; frequency: string; pricePerVisit: number; nextDate: string; active: boolean };

const FREQUENCY_KEYS: Record<string, DictKey> = {
  weekly: "freqWeekly",
  biweekly: "freqBiweekly",
  every_3_weeks: "freqEvery3Weeks",
  monthly: "freqMonthly",
  bimonthly: "freqBimonthly",
};

const PAYMENT_METHOD_LABEL_KEYS: Record<"cash" | "zelle" | "venmo", DictKey> = {
  cash: "paymentMethodCash",
  zelle: "paymentMethodZelle",
  venmo: "paymentMethodVenmo",
};

type ServiceRow = { name: string; basePrice: number };
type MowingEstimate = { sqft: number; total: number | null; overgrownFee: number; needsManualQuote: boolean };
type AvailabilityDay = { date: string; count: number; times: string[] };
type FenceEstimate = { lengthFt: number; material: string; total: number };
type PressureLineItem = { key: string; sqft: number; rate: number; cost: number };
type PressureEstimate = { lineItems: PressureLineItem[]; total: number };

const WEEKDAY_LETTERS: Record<"en" | "es", string[]> = {
  en: ["S", "M", "T", "W", "T", "F", "S"],
  es: ["D", "L", "M", "M", "J", "V", "S"],
};

export default function BookPage() {
  const { t, lang } = useLanguage();
  const dateLocale = lang === "es" ? "es-ES" : "en-US";

  const FENCE_MATERIALS = [
    { value: "chain_link", label: t("materialChainLink") },
    { value: "wood", label: t("materialWood") },
    { value: "vinyl", label: t("materialVinyl") },
  ];
  const PRESSURE_SURFACES = [
    { key: "driveway", label: t("surfaceDriveway") },
    { key: "siding", label: t("surfaceSiding") },
    { key: "patio", label: t("surfacePatio") },
    { key: "fence_wash", label: t("surfaceFence") },
  ];

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "zelle" | "venmo" | "">("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [mowingEstimate, setMowingEstimate] = useState<MowingEstimate | null>(null);
  const [grassHeightIn, setGrassHeightIn] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const polygonRef = useRef<any>(null);

  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [myPlan, setMyPlan] = useState<MyRecurringPlan | null>(null);
  const [mowingFrequency, setMowingFrequency] = useState("");
  const [binFrequency, setBinFrequency] = useState("");

  // Fence Building measuring
  const [fenceMapLoading, setFenceMapLoading] = useState(false);
  const [fenceMapError, setFenceMapError] = useState<string | null>(null);
  const [showFenceMap, setShowFenceMap] = useState(false);
  const [fencePointCount, setFencePointCount] = useState(0);
  const [fenceMaterial, setFenceMaterial] = useState("chain_link");
  const [fenceEstimate, setFenceEstimate] = useState<FenceEstimate | null>(null);
  const fenceMapRef = useRef<HTMLDivElement>(null);
  const fencePolylineRef = useRef<any>(null);

  // Pressure Washing measuring
  const [pressureMapLoading, setPressureMapLoading] = useState(false);
  const [pressureMapError, setPressureMapError] = useState<string | null>(null);
  const [activePressureSurface, setActivePressureSurface] = useState<string | null>(null);
  const [pressurePointCount, setPressurePointCount] = useState(0);
  const [pressureSelected, setPressureSelected] = useState<Record<string, boolean>>({});
  const [pressureSqft, setPressureSqft] = useState<Record<string, string>>({});
  const [pressureEstimate, setPressureEstimate] = useState<PressureEstimate | null>(null);
  const pressureMapRef = useRef<HTMLDivElement>(null);
  const pressurePolygonRef = useRef<any>(null);
  const pressureLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then(setServices);

    fetch("/api/bookings/availability")
      .then((r) => r.json())
      .then((data) => setAvailability(data.days ?? []));

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((session) => {
        if (session?.loggedIn && session.role === "customer") {
          setEmail(session.email);
          fetch("/api/my/recurring-plan")
            .then((r) => r.json())
            .then((data) => {
              if (data?.recurringPlan?.active) setMyPlan(data.recurringPlan);
            });
          fetch("/api/my/service-frequencies")
            .then((r) => r.json())
            .then((data) => {
              if (data?.mowingFrequency) setMowingFrequency(data.mowingFrequency);
              if (data?.binCleaningFrequency) setBinFrequency(data.binCleaningFrequency);
            });
          fetch("/api/my/profile")
            .then((r) => r.json())
            .then((data) => {
              if (data?.name) setName(data.name);
              if (data?.phone) setPhone(data.phone);
              if (data?.address) setAddress(data.address);
            });
        }
      });
  }, []);

  function toggleService(name: string) {
    setSelectedServices((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]
    );
    if (name === "Mowing") {
      setShowMap(false);
      setMowingEstimate(null);
    }
    if (name === "Fence Building") {
      setShowFenceMap(false);
      setFenceEstimate(null);
    }
    if (name === "Pressure Washing") {
      setActivePressureSurface(null);
      setPressureEstimate(null);
      setPressureSelected({});
      setPressureSqft({});
    }
  }

  async function getLawnEstimate() {
    if (!address) {
      setMapError(t("enterAddressFirst"));
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
        setMapError(data.error ?? t("couldNotLocate"));
        return;
      }
      setShowMap(true);
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setMapError(t("mapsNotConfigured"));
        return;
      }
      await loadGoogleMaps(apiKey);
      initMap(data.location);
    } catch {
      setMapError(t("somethingWentWrong"));
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
      setMapError(t("clickAtLeast3"));
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
      setMapError(data.error ?? t("couldNotPriceLawn"));
    }
  }

  async function measureFenceLine() {
    if (!address) {
      setFenceMapError(t("enterAddressFirst"));
      return;
    }
    setFenceMapError(null);
    setFenceEstimate(null);
    setFenceMapLoading(true);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFenceMapError(data.error ?? t("couldNotLocate"));
        return;
      }
      setShowFenceMap(true);
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setFenceMapError(t("mapsNotConfigured"));
        return;
      }
      await loadGoogleMaps(apiKey);
      initFenceMap(data.location);
    } catch {
      setFenceMapError(t("somethingWentWrong"));
    } finally {
      setFenceMapLoading(false);
    }
  }

  function initFenceMap(location: { lat: number; lng: number }) {
    if (!fenceMapRef.current) return;
    const google = window.google;
    const map = new google.maps.Map(fenceMapRef.current, {
      center: location,
      zoom: 20,
      mapTypeId: "satellite",
    });
    const polyline = new google.maps.Polyline({
      map,
      path: [],
      editable: true,
      strokeColor: "#34d67f",
      strokeWeight: 3,
    });
    fencePolylineRef.current = polyline;
    setFencePointCount(0);

    map.addListener("click", (e: any) => {
      const path = polyline.getPath();
      path.push(e.latLng);
      setFencePointCount(path.getLength());
    });
  }

  async function finishFenceMeasuring() {
    const google = window.google;
    const polyline = fencePolylineRef.current;
    if (!polyline || polyline.getPath().getLength() < 2) {
      setFenceMapError(t("clickAtLeast2Fence"));
      return;
    }
    const lengthM = google.maps.geometry.spherical.computeLength(polyline.getPath());
    const lengthFt = Math.round(lengthM * 3.28084);
    const res = await fetch("/api/estimate/fence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lengthFt, material: fenceMaterial }),
    });
    const data = await res.json();
    if (res.ok) {
      setFenceEstimate({ lengthFt, material: fenceMaterial, total: data.total });
    } else {
      setFenceMapError(data.error ?? t("couldNotPriceFence"));
    }
  }

  function clearFenceLine() {
    fencePolylineRef.current?.getPath().clear();
    setFencePointCount(0);
    setFenceMapError(null);
  }

  async function measurePressureSurface(key: string) {
    if (!address) {
      setPressureMapError(t("enterAddressFirst"));
      return;
    }
    setPressureMapError(null);
    setPressureMapLoading(true);
    try {
      if (!pressureLocationRef.current) {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const data = await res.json();
        if (!res.ok) {
          setPressureMapError(data.error ?? t("couldNotLocate"));
          return;
        }
        pressureLocationRef.current = data.location;
      }
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setPressureMapError(t("mapsNotConfigured"));
        return;
      }
      await loadGoogleMaps(apiKey);
      setPressurePointCount(0);
      setActivePressureSurface(key);
    } catch {
      setPressureMapError(t("somethingWentWrong"));
    } finally {
      setPressureMapLoading(false);
    }
  }

  useEffect(() => {
    if (!activePressureSurface || !pressureMapRef.current || !pressureLocationRef.current) return;
    const google = window.google;

    const map = new google.maps.Map(pressureMapRef.current, {
      center: pressureLocationRef.current,
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
    pressurePolygonRef.current = polygon;

    map.addListener("click", (e: any) => {
      const path = polygon.getPath();
      path.push(e.latLng);
      setPressurePointCount(path.getLength());
    });
  }, [activePressureSurface]);

  function finishPressureMeasuring() {
    const google = window.google;
    const polygon = pressurePolygonRef.current;
    if (!polygon || polygon.getPath().getLength() < 3 || !activePressureSurface) {
      setPressureMapError(t("clickAtLeast3Surface"));
      return;
    }
    const areaSqM = google.maps.geometry.spherical.computeArea(polygon.getPath());
    const areaSqFt = Math.round(areaSqM * 10.7639);
    setPressureSqft((prev) => ({ ...prev, [activePressureSurface]: String(areaSqFt) }));
    setPressureSelected((prev) => ({ ...prev, [activePressureSurface]: true }));
    setActivePressureSurface(null);
  }

  function clearActivePressurePolygon() {
    pressurePolygonRef.current?.getPath().clear();
    setPressurePointCount(0);
    setPressureMapError(null);
  }

  function togglePressureSurface(key: string) {
    setPressureSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function calculatePressureEstimate() {
    const surfaces = PRESSURE_SURFACES.filter(
      (s) => pressureSelected[s.key] && Number(pressureSqft[s.key]) > 0
    ).map((s) => ({ key: s.key, sqft: Number(pressureSqft[s.key]) }));

    if (surfaces.length === 0) {
      setPressureMapError(t("selectSurfaceFirst"));
      return;
    }

    const res = await fetch("/api/estimate/pressure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surfaces }),
    });
    const data = await res.json();
    if (res.ok) {
      setPressureEstimate({ lineItems: data.lineItems, total: data.total });
      setPressureMapError(null);
    } else {
      setPressureMapError(data.error ?? t("couldNotPriceSurfaces"));
    }
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    if (selectedServices.length === 0) {
      setStatus(t("pleaseSelectService"));
      return;
    }
    if (!paymentMethod) {
      setStatus(t("pleaseSelectPaymentMethod"));
      return;
    }
    setIsSubmitting(true);
    setStatus(t("bookingBtn"));
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          services: selectedServices,
          mowingFrequency: selectedServices.includes("Mowing") ? mowingFrequency || undefined : undefined,
          binCleaningFrequency: selectedServices.includes("Bin Cleaning") ? binFrequency || undefined : undefined,
          address,
          scheduledFor: new Date(`${date}T${time}`).toISOString(),
          isEmergency,
          paymentMethod,
        }),
      });
      if (res.ok) {
        setStatus(t("bookedStatus", { email }));
      } else {
        const err = await res.json();
        setStatus(t("errorStatus", { msg: JSON.stringify(err.error) }));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const mowingSelected = selectedServices.includes("Mowing");

  return (
    <main>
      <div className="card">
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>
          Your lawn, <span className="accent">handled.</span>
        </h1>
        <p style={{ color: "var(--text-muted)", marginTop: -4 }}>{t("tagline")}</p>
        <h2 style={{ marginTop: 24, fontSize: 18 }}>{t("bookHeading")}</h2>

        {myPlan && (
          <div
            style={{
              border: "1px solid var(--accent)",
              background: "rgba(52,214,127,0.08)",
              borderRadius: 8,
              padding: 12,
              marginBottom: 16,
            }}
          >
            <p style={{ margin: 0 }} className="accent">
              {t("myPlanBanner", {
                price: String(myPlan.pricePerVisit),
                frequency: t(FREQUENCY_KEYS[myPlan.frequency] ?? "freqBiweekly"),
              })}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              {t("myPlanNextDate", {
                date: new Date(myPlan.nextDate).toLocaleDateString(lang === "es" ? "es-ES" : "en-US", { timeZone: "UTC" }),
              })}{" "}
              <a href="/account">{t("myPlanManageLink")}</a>
            </p>
          </div>
        )}

        <form onSubmit={submitBooking}>
          <label>{t("servicesLabel")}</label>
          {services.map((s) => (
            <div key={s.name}>
              <label style={{ display: "block", fontWeight: "normal" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto", marginRight: 8 }}
                  checked={selectedServices.includes(s.name)}
                  onChange={() => toggleService(s.name)}
                />
                {s.name}
              </label>
              {s.name === "Mowing" && selectedServices.includes("Mowing") && (
                <div style={{ margin: "4px 0 10px 24px" }}>
                  <label style={{ fontWeight: "normal", fontSize: 12 }}>{t("mowingFrequencyLabel")}</label>
                  <select value={mowingFrequency} onChange={(e) => setMowingFrequency(e.target.value)} style={{ maxWidth: 220 }}>
                    <option value="">{t("noPreferenceOption")}</option>
                    {SERVICE_FREQUENCY_VALUES.map((f) => (
                      <option key={f} value={f}>
                        {t(FREQUENCY_KEYS[f])}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {s.name === "Bin Cleaning" && selectedServices.includes("Bin Cleaning") && (
                <div style={{ margin: "4px 0 10px 24px" }}>
                  <label style={{ fontWeight: "normal", fontSize: 12 }}>{t("binFrequencyLabel")}</label>
                  <select value={binFrequency} onChange={(e) => setBinFrequency(e.target.value)} style={{ maxWidth: 220 }}>
                    <option value="">{t("noPreferenceOption")}</option>
                    {SERVICE_FREQUENCY_VALUES.map((f) => (
                      <option key={f} value={f}>
                        {t(FREQUENCY_KEYS[f])}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}

          <label>{t("nameLabel")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />

          <label>{t("emailLabel")}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label>{t("phoneLabel")}</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />

          <label>{t("addressLabel")}</label>
          <AddressInput value={address} onChange={setAddress} required />

          {mowingSelected && (
            <div style={{ marginTop: -4, marginBottom: 16 }}>
              {!mowingEstimate && (
                <>
                  <label style={{ fontWeight: "normal", fontSize: 13 }}>{t("grassHeightLabel")}</label>
                  <input
                    type="number"
                    min={0}
                    placeholder={t("grassHeightPlaceholder")}
                    value={grassHeightIn}
                    onChange={(e) => setGrassHeightIn(e.target.value)}
                    style={{ maxWidth: 120 }}
                  />
                  <button type="button" onClick={getLawnEstimate} disabled={mapLoading}>
                    {mapLoading ? t("loadingMap") : t("measureLawnBtn")}
                  </button>
                </>
              )}
              {mapError && <p style={{ color: "var(--gold)" }}>{mapError}</p>}
              {showMap && !mowingEstimate && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    {t("clickPointsLawn")}{" "}
                    {t("pointsPlaced", { count: pointCount, s: pointCount === 1 ? "" : "s" })}
                  </p>
                  <div
                    ref={mapRef}
                    style={{ height: 400, width: "100%", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 10 }}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={finishMeasuring} disabled={pointCount < 3}>
                      {t("finishMeasuring")}
                    </button>
                    <button type="button" onClick={clearLawnBoundary} disabled={pointCount === 0}>
                      {t("clear")}
                    </button>
                  </div>
                </div>
              )}
              {mowingEstimate && mowingEstimate.needsManualQuote && (
                <p className="accent">
                  {t("lawnMeasuredManual", { sqft: mowingEstimate.sqft.toLocaleString() })}
                </p>
              )}
              {mowingEstimate && !mowingEstimate.needsManualQuote && (
                <p className="accent">
                  {t("lawnMeasuredPrice", { sqft: mowingEstimate.sqft.toLocaleString(), total: mowingEstimate.total ?? 0 })}
                  {mowingEstimate.overgrownFee > 0 && t("overgrownFeeNote", { fee: mowingEstimate.overgrownFee })}
                </p>
              )}
            </div>
          )}

          {selectedServices.includes("Fence Building") && (
            <div style={{ marginTop: -4, marginBottom: 16 }}>
              {!fenceEstimate && (
                <>
                  <label style={{ fontWeight: "normal", fontSize: 13 }}>{t("fenceMaterialLabel")}</label>
                  <select value={fenceMaterial} onChange={(e) => setFenceMaterial(e.target.value)} style={{ maxWidth: 200 }}>
                    {FENCE_MATERIALS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={measureFenceLine} disabled={fenceMapLoading}>
                    {fenceMapLoading ? t("loadingMap") : t("measureFenceBtn")}
                  </button>
                </>
              )}
              {fenceMapError && <p style={{ color: "var(--gold)" }}>{fenceMapError}</p>}
              {showFenceMap && !fenceEstimate && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    {t("clickPointsFence")}{" "}
                    {t("pointsPlaced", { count: fencePointCount, s: fencePointCount === 1 ? "" : "s" })}
                  </p>
                  <div
                    ref={fenceMapRef}
                    style={{ height: 400, width: "100%", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 10 }}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={finishFenceMeasuring} disabled={fencePointCount < 2}>
                      {t("finishMeasuring")}
                    </button>
                    <button type="button" onClick={clearFenceLine} disabled={fencePointCount === 0}>
                      {t("clear")}
                    </button>
                  </div>
                </div>
              )}
              {fenceEstimate && (
                <p className="accent">
                  {t("fenceMeasuredPrice", {
                    ft: fenceEstimate.lengthFt,
                    material: FENCE_MATERIALS.find((m) => m.value === fenceEstimate.material)?.label ?? "",
                    total: fenceEstimate.total,
                  })}
                </p>
              )}
            </div>
          )}

          {selectedServices.includes("Pressure Washing") && (
            <div style={{ marginTop: -4, marginBottom: 16 }}>
              <label style={{ fontWeight: "normal", fontSize: 13 }}>{t("surfacesToWashLabel")}</label>
              {PRESSURE_SURFACES.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    style={{ width: "auto", margin: 0 }}
                    checked={!!pressureSelected[s.key]}
                    onChange={() => togglePressureSurface(s.key)}
                  />
                  <span style={{ minWidth: 80 }}>{s.label}</span>
                  <input
                    type="number"
                    min={1}
                    placeholder={t("sqftPlaceholder")}
                    disabled={!pressureSelected[s.key]}
                    value={pressureSqft[s.key] ?? ""}
                    onChange={(e) => setPressureSqft((prev) => ({ ...prev, [s.key]: e.target.value }))}
                    style={{ marginBottom: 0, width: 100 }}
                  />
                  <button
                    type="button"
                    onClick={() => measurePressureSurface(s.key)}
                    disabled={pressureMapLoading}
                    style={{ fontSize: 12, padding: "8px 10px" }}
                  >
                    {t("measureViaMapBtn")}
                  </button>
                </div>
              ))}

              {pressureMapError && <p style={{ color: "var(--gold)" }}>{pressureMapError}</p>}

              {activePressureSurface && (
                <div style={{ marginTop: 4, marginBottom: 16 }}>
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    {t("outlining")}{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {PRESSURE_SURFACES.find((s) => s.key === activePressureSurface)?.label}
                    </strong>{" "}
                    — {t("clickPointsSurface")}{" "}
                    {t("pointsPlaced", { count: pressurePointCount, s: pressurePointCount === 1 ? "" : "s" })}
                  </p>
                  <div
                    ref={pressureMapRef}
                    style={{ height: 400, width: "100%", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 10 }}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" onClick={finishPressureMeasuring} disabled={pressurePointCount < 3}>
                      {t("finishMeasuring")}
                    </button>
                    <button type="button" onClick={clearActivePressurePolygon} disabled={pressurePointCount === 0}>
                      {t("clear")}
                    </button>
                  </div>
                </div>
              )}

              <button type="button" onClick={calculatePressureEstimate} style={{ fontSize: 13 }}>
                {t("calculatePressureBtn")}
              </button>

              {pressureEstimate && (
                <div style={{ marginTop: 8 }}>
                  {pressureEstimate.lineItems.map((li) => (
                    <p key={li.key} className="accent" style={{ margin: "2px 0", fontSize: 13 }}>
                      {t("pressureLineItem", {
                        surface: PRESSURE_SURFACES.find((s) => s.key === li.key)?.label ?? "",
                        sqft: li.sqft,
                        rate: li.rate,
                        cost: li.cost,
                      })}
                    </p>
                  ))}
                  <p className="accent" style={{ fontWeight: 700 }}>
                    {t("pressureTotal", { total: pressureEstimate.total })}
                  </p>
                </div>
              )}
            </div>
          )}

          <label>{t("dateLabel")}</label>
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
                {calendarMonth.toLocaleDateString(dateLocale, { month: "long", year: "numeric" })}
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
              {WEEKDAY_LETTERS[lang].map((d, i) => (
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
                        <div style={{ fontSize: 9, color: "var(--gold)" }}>
                          {t("bookedCount", { count: dayAvailability.count })}
                        </div>
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
                    {t("selectedDatePrefix")}{" "}
                    <strong style={{ color: "var(--text)" }}>
                      {new Date(date + "T00:00:00").toLocaleDateString(dateLocale, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </strong>
                    {selected
                      ? t("otherBookingsNote", {
                          count: selected.count,
                          s: selected.count === 1 ? "" : "s",
                          times: selected.times.join(", "),
                        })
                      : t("noBookingsNote")}
                  </p>
                );
              })()}
          </div>

          <label>{t("timeLabel")}</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />

          <label>{t("paymentMethodLabel")}</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["cash", "zelle", "venmo"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: paymentMethod === method ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: paymentMethod === method ? "rgba(52,214,127,0.15)" : "var(--bg-input)",
                  color: "var(--text)",
                  fontWeight: paymentMethod === method ? 700 : 400,
                }}
              >
                {t(PAYMENT_METHOD_LABEL_KEYS[method])}
              </button>
            ))}
          </div>

          <label>
            <input
              type="checkbox"
              style={{ width: "auto", marginRight: 8 }}
              checked={isEmergency}
              onChange={(e) => setIsEmergency(e.target.checked)}
            />
            {t("emergencyLabel")}
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t("bookingBtn") : t("confirmBtn")}
          </button>
        </form>
        {status && <p>{status}</p>}
      </div>
    </main>
  );
}
