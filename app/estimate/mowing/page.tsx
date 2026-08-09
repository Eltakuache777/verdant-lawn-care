"use client";
import { useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { useLanguage } from "@/app/components/LanguageProvider";
import AddressInput from "@/app/components/AddressInput";

type MowingEstimate = { sqft: number; total: number | null; overgrownFee: number; needsManualQuote: boolean };

export default function MowingEstimatePage() {
  const { t } = useLanguage();

  const [address, setAddress] = useState("");
  const [grassHeightIn, setGrassHeightIn] = useState("");
  const [mowingEstimate, setMowingEstimate] = useState<MowingEstimate | null>(null);

  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [savedAreas, setSavedAreas] = useState<number[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const finishedPolygonsRef = useRef<any[]>([]);

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
    mapObjRef.current = map;
    startNewPolygon();

    map.addListener("click", (e: any) => {
      const path = polygonRef.current?.getPath();
      if (!path) return;
      path.push(e.latLng);
      setPointCount(path.getLength());
    });
  }

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

  // Adds the current shape's area to the running list and starts a fresh
  // shape — separate lawn sections (front/back, split by the house, etc.)
  // don't have to be one connected outline.
  function addThisArea() {
    const google = window.google;
    const polygon = polygonRef.current;
    if (!polygon || polygon.getPath().getLength() < 3) {
      setMapError(t("clickAtLeast3"));
      return;
    }
    const areaSqM = google.maps.geometry.spherical.computeArea(polygon.getPath());
    const areaSqFt = Math.round(areaSqM * 10.7639);
    polygon.setEditable(false);
    polygon.setOptions({ fillOpacity: 0.15, strokeOpacity: 0.6 });
    finishedPolygonsRef.current.push(polygon);
    setSavedAreas((prev) => [...prev, areaSqFt]);
    setMapError(null);
    startNewPolygon();
  }

  function removeArea(index: number) {
    finishedPolygonsRef.current[index]?.setMap(null);
    finishedPolygonsRef.current.splice(index, 1);
    setSavedAreas((prev) => prev.filter((_, i) => i !== index));
  }

  function finishMeasuring() {
    const total = savedAreas.reduce((sum, a) => sum + a, 0);
    if (total <= 0) {
      setMapError(t("clickAtLeast3"));
      return;
    }
    computeMowingEstimate(total);
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

  return (
    <main>
      <div className="card">
        <h1>{t("mowingEstimateTitle")}</h1>

        <label>{t("addressOptionalMowing")}</label>
        <AddressInput value={address} onChange={setAddress} />

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
              {t("clickPointsLawn")} {t("pointsPlaced", { count: pointCount, s: pointCount === 1 ? "" : "s" })}
            </p>
            <div
              ref={mapRef}
              style={{ height: 400, width: "100%", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button type="button" onClick={addThisArea} disabled={pointCount < 3}>
                {savedAreas.length === 0 ? t("addThisAreaBtn") : t("addAnotherAreaBtn")}
              </button>
              <button type="button" onClick={clearLawnBoundary} disabled={pointCount === 0}>
                {t("clear")}
              </button>
            </div>

            {savedAreas.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {savedAreas.map((sqft, i) => (
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
                      onClick={() => removeArea(i)}
                      aria-label={t("removeAreaAria")}
                      style={{ background: "transparent", color: "var(--text-muted)", padding: "0 4px", fontWeight: 700 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <p className="accent" style={{ fontWeight: 700, margin: "8px 0" }}>
                  {t("totalSqftSoFar", { sqft: savedAreas.reduce((s, a) => s + a, 0).toLocaleString() })}
                </p>
                <button type="button" onClick={finishMeasuring}>
                  {t("doneMeasuringBtn")}
                </button>
              </div>
            )}
          </div>
        )}

        {mowingEstimate && mowingEstimate.needsManualQuote && (
          <p className="accent" style={{ marginTop: 16 }}>
            {t("lawnMeasuredManual", { sqft: mowingEstimate.sqft.toLocaleString() })}
          </p>
        )}
        {mowingEstimate && !mowingEstimate.needsManualQuote && (
          <p className="accent" style={{ marginTop: 16 }}>
            {t("lawnMeasuredPrice", { sqft: mowingEstimate.sqft.toLocaleString(), total: mowingEstimate.total ?? 0 })}
            {mowingEstimate.overgrownFee > 0 && t("overgrownFeeNote", { fee: mowingEstimate.overgrownFee })}
          </p>
        )}
      </div>
    </main>
  );
}
