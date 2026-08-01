"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { useLanguage } from "@/app/components/LanguageProvider";
import AddressInput from "@/app/components/AddressInput";

type LineItem = { key: string; sqft: number; rate: number; cost: number };
type Result = { lineItems: LineItem[]; subtotal: number; minimumPrice: number; total: number };

export default function PressureEstimatePage() {
  const { t } = useLanguage();
  const SURFACES = [
    { key: "driveway", label: t("surfaceDriveway") },
    { key: "siding", label: t("surfaceSiding") },
    { key: "patio", label: t("surfacePatio") },
    { key: "fence_wash", label: t("surfaceFence") },
  ];

  const [address, setAddress] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [sqft, setSqft] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [activeSurface, setActiveSurface] = useState<string | null>(null);
  const [pointCount, setPointCount] = useState(0);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);

  function toggleSurface(key: string) {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function measureSurface(key: string) {
    if (!address) {
      setMapError(t("enterAddressFirst"));
      return;
    }
    setMapError(null);
    setMapLoading(true);
    try {
      if (!locationRef.current) {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMapError(data.error ?? t("couldNotLocate"));
          return;
        }
        locationRef.current = data.location;
      }
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setMapError(t("mapsNotConfigured"));
        return;
      }
      await loadGoogleMaps(apiKey);
      // Setting activeSurface mounts the map div; the effect below creates the
      // actual map once that div exists (can't create it here — it isn't in the DOM yet).
      setPointCount(0);
      setActiveSurface(key);
    } catch {
      setMapError(t("somethingWentWrong"));
    } finally {
      setMapLoading(false);
    }
  }

  useEffect(() => {
    if (!activeSurface || !mapRef.current || !locationRef.current) return;
    const google = window.google;

    const map = new google.maps.Map(mapRef.current, {
      center: locationRef.current,
      zoom: 20,
      mapTypeId: "satellite",
    });
    mapObjRef.current = map;

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

    map.addListener("click", (e: any) => {
      const path = polygon.getPath();
      path.push(e.latLng);
      setPointCount(path.getLength());
    });
  }, [activeSurface]);

  function finishMeasuring() {
    const google = window.google;
    const polygon = polygonRef.current;
    if (!polygon || polygon.getPath().getLength() < 3 || !activeSurface) {
      setMapError(t("clickAtLeast3Surface"));
      return;
    }
    const areaSqM = google.maps.geometry.spherical.computeArea(polygon.getPath());
    const areaSqFt = Math.round(areaSqM * 10.7639);
    setSqft((prev) => ({ ...prev, [activeSurface]: String(areaSqFt) }));
    setSelected((prev) => ({ ...prev, [activeSurface]: true }));
    setActiveSurface(null);
  }

  function clearActivePolygon() {
    polygonRef.current?.getPath().clear();
    setPointCount(0);
    setMapError(null);
  }

  async function getEstimate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const surfaces = SURFACES.filter((s) => selected[s.key] && Number(sqft[s.key]) > 0).map((s) => ({
      key: s.key,
      sqft: Number(sqft[s.key]),
    }));

    if (surfaces.length === 0) {
      setError(t("selectSurfaceFirst"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/estimate/pressure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surfaces }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("somethingWentWrong"));
      } else {
        setResult(data);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="card">
        <h1>{t("pressureEstimateTitle")}</h1>
        <form onSubmit={getEstimate}>
          <label>{t("addressOptionalSurfaces")}</label>
          <AddressInput value={address} onChange={setAddress} />

          <label>{t("surfacesLabel")}</label>
          {SURFACES.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <input
                type="checkbox"
                style={{ width: "auto", margin: 0 }}
                checked={!!selected[s.key]}
                onChange={() => toggleSurface(s.key)}
              />
              <span style={{ minWidth: 80 }}>{s.label}</span>
              <input
                type="number"
                min={1}
                placeholder="sq ft"
                disabled={!selected[s.key]}
                value={sqft[s.key] ?? ""}
                onChange={(e) => setSqft((prev) => ({ ...prev, [s.key]: e.target.value }))}
                style={{ marginBottom: 0, width: 100 }}
              />
              <button
                type="button"
                onClick={() => measureSurface(s.key)}
                disabled={mapLoading}
                style={{ fontSize: 12, padding: "8px 10px" }}
              >
                {t("measureViaMapBtn")}
              </button>
            </div>
          ))}

          {mapError && <p style={{ color: "var(--gold)" }}>{mapError}</p>}

          {activeSurface && (
            <div style={{ marginTop: 4, marginBottom: 16 }}>
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {t("outlining")} <strong style={{ color: "var(--text)" }}>
                  {SURFACES.find((s) => s.key === activeSurface)?.label}
                </strong>{" "}
                — {t("clickPointsSurface")} ({t("pointsPlaced", { count: pointCount, s: pointCount === 1 ? "" : "s" })})
              </p>
              <div
                ref={mapRef}
                style={{ height: 400, width: "100%", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 10 }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={finishMeasuring} disabled={pointCount < 3}>
                  {t("finishMeasuring")}
                </button>
                <button type="button" onClick={clearActivePolygon} disabled={pointCount === 0}>
                  {t("clear")}
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} style={{ marginTop: 10 }}>
            {loading ? t("calculatingBtn") : t("getEstimateBtn")}
          </button>
        </form>

        {error && <p>{error}</p>}

        {result && (
          <div style={{ marginTop: 16 }}>
            <h3>{t("estimateHeading")}</h3>
            {result.lineItems.map((li) => (
              <p key={li.key}>
                {t("pressureLineItem", {
                  surface: SURFACES.find((s) => s.key === li.key)?.label ?? "",
                  sqft: String(li.sqft),
                  rate: String(li.rate),
                  cost: String(li.cost),
                })}
              </p>
            ))}
            <p>
              {t("subtotalLabel")}: ${result.subtotal}
            </p>
            <p>
              {t("minimumJobPrice")}: ${result.minimumPrice}
            </p>
            <p>
              <strong>
                {t("totalLabel")}: ${result.total}
              </strong>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
