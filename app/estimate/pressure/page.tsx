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
  const [activeSurfaceAreas, setActiveSurfaceAreas] = useState<number[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const finishedPolygonsRef = useRef<any[]>([]);
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
      setActiveSurfaceAreas([]);
      finishedPolygonsRef.current = [];
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
    startNewPolygon();

    map.addListener("click", (e: any) => {
      const path = polygonRef.current?.getPath();
      if (!path) return;
      path.push(e.latLng);
      setPointCount(path.getLength());
    });
  }, [activeSurface]);

  function startNewPolygon() {
    const google = window.google;
    const polygon = new google.maps.Polygon({
      map: mapObjRef.current,
      path: [],
      editable: true,
      fillColor: "#34d67f",
      fillOpacity: 0.3,
      strokeColor: "#34d67f",
      strokeWeight: 2,
    });
    polygonRef.current = polygon;
    setPointCount(0);
  }

  // Adds the current shape's area to this surface's running list and starts
  // a fresh shape — e.g. a driveway split into two disconnected slabs.
  function addThisArea() {
    const google = window.google;
    const polygon = polygonRef.current;
    if (!polygon || polygon.getPath().getLength() < 3) {
      setMapError(t("clickAtLeast3Surface"));
      return;
    }
    const areaSqM = google.maps.geometry.spherical.computeArea(polygon.getPath());
    const areaSqFt = Math.round(areaSqM * 10.7639);
    polygon.setEditable(false);
    polygon.setOptions({ fillOpacity: 0.15, strokeOpacity: 0.6 });
    finishedPolygonsRef.current.push(polygon);
    setActiveSurfaceAreas((prev) => [...prev, areaSqFt]);
    setMapError(null);
    startNewPolygon();
  }

  function removeActiveArea(index: number) {
    finishedPolygonsRef.current[index]?.setMap(null);
    finishedPolygonsRef.current.splice(index, 1);
    setActiveSurfaceAreas((prev) => prev.filter((_, i) => i !== index));
  }

  function finishMeasuring() {
    const total = activeSurfaceAreas.reduce((sum, a) => sum + a, 0);
    if (total <= 0 || !activeSurface) {
      setMapError(t("clickAtLeast3Surface"));
      return;
    }
    setSqft((prev) => ({ ...prev, [activeSurface]: String(total) }));
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
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <button type="button" onClick={addThisArea} disabled={pointCount < 3}>
                  {activeSurfaceAreas.length === 0 ? t("addThisAreaBtn") : t("addAnotherAreaBtn")}
                </button>
                <button type="button" onClick={clearActivePolygon} disabled={pointCount === 0}>
                  {t("clear")}
                </button>
              </div>

              {activeSurfaceAreas.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {activeSurfaceAreas.map((sqft, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 10px",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        marginBottom: 6,
                        fontSize: 13,
                      }}
                    >
                      <span>{t("areaLine", { n: i + 1, sqft: sqft.toLocaleString() })}</span>
                      <button
                        type="button"
                        onClick={() => removeActiveArea(i)}
                        aria-label={t("removeAreaAria")}
                        style={{ background: "transparent", color: "var(--text-muted)", padding: "0 4px", fontWeight: 700 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <p className="accent" style={{ fontWeight: 700, margin: "8px 0" }}>
                    {t("totalSqftSoFar", { sqft: activeSurfaceAreas.reduce((s, a) => s + a, 0).toLocaleString() })}
                  </p>
                  <button type="button" onClick={finishMeasuring}>
                    {t("doneMeasuringBtn")}
                  </button>
                </div>
              )}
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
