"use client";
import { useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { useLanguage } from "@/app/components/LanguageProvider";
import AddressInput from "@/app/components/AddressInput";

type Result = {
  lengthFt: number;
  material: string;
  rate: number;
  bySize: number;
  minimumPrice: number;
  total: number;
};

export default function FenceEstimatePage() {
  const { t } = useLanguage();
  const MATERIALS = [
    { value: "chain_link", label: t("materialChainLink") },
    { value: "wood", label: t("materialWood") },
    { value: "vinyl", label: t("materialVinyl") },
  ];

  const [address, setAddress] = useState("");
  const [lengthFt, setLengthFt] = useState("");
  const [material, setMaterial] = useState("chain_link");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [measuredFt, setMeasuredFt] = useState<number | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const polylineRef = useRef<any>(null);

  async function measureViaMap() {
    if (!address) {
      setMapError(t("selectAddressFirstSimple"));
      return;
    }
    setMapError(null);
    setMeasuredFt(null);
    setMapLoading(true);
    try {
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
    const polyline = new google.maps.Polyline({
      map,
      path: [],
      editable: true,
      strokeColor: "#34d67f",
      strokeWeight: 3,
    });
    polylineRef.current = polyline;
    setPointCount(0);

    map.addListener("click", (e: any) => {
      const path = polyline.getPath();
      path.push(e.latLng);
      setPointCount(path.getLength());
    });
  }

  function finishMeasuring() {
    const google = window.google;
    const polyline = polylineRef.current;
    if (!polyline || polyline.getPath().getLength() < 2) {
      setMapError(t("clickAtLeast2Fence"));
      return;
    }
    const lengthM = google.maps.geometry.spherical.computeLength(polyline.getPath());
    const ft = Math.round(lengthM * 3.28084);
    setMeasuredFt(ft);
    setLengthFt(String(ft));
  }

  function clearLine() {
    polylineRef.current?.getPath().clear();
    setPointCount(0);
    setMapError(null);
  }

  async function getEstimate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/estimate/fence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lengthFt: Number(lengthFt), material }),
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
        <h1>{t("fenceEstimateTitle")}</h1>
        <form onSubmit={getEstimate}>
          <label>{t("addressOptionalFence")}</label>
          <AddressInput value={address} onChange={setAddress} />

          <div style={{ marginBottom: 16 }}>
            {!measuredFt && (
              <button type="button" onClick={measureViaMap} disabled={mapLoading}>
                {mapLoading ? t("loadingMap") : t("measureFenceBtn")}
              </button>
            )}
            {mapError && <p style={{ color: "var(--gold)" }}>{mapError}</p>}
            {showMap && !measuredFt && (
              <div style={{ marginTop: 12 }}>
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  {t("clickPointsFence")} {t("pointsPlaced", { count: pointCount, s: pointCount === 1 ? "" : "s" })}
                </p>
                <div
                  ref={mapRef}
                  style={{ height: 400, width: "100%", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 10 }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={finishMeasuring} disabled={pointCount < 2}>
                    {t("finishMeasuring")}
                  </button>
                  <button type="button" onClick={clearLine} disabled={pointCount === 0}>
                    {t("clear")}
                  </button>
                </div>
              </div>
            )}
            {measuredFt && (
              <p className="accent">
                {t("measuredLengthPrefix")}: {measuredFt} ft
              </p>
            )}
          </div>

          <label>{t("fenceLengthFeetLabel")}</label>
          <input
            type="number"
            min={1}
            value={lengthFt}
            onChange={(e) => setLengthFt(e.target.value)}
            required
          />

          <label>{t("materialLabel")}</label>
          <select value={material} onChange={(e) => setMaterial(e.target.value)}>
            {MATERIALS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <button type="submit" disabled={loading}>
            {loading ? t("calculatingBtn") : t("getEstimateBtn")}
          </button>
        </form>

        {error && (
          <p>
            {t("errorPrefix")}: {error}
          </p>
        )}

        {result && (
          <div style={{ marginTop: 16 }}>
            <h3>{t("estimateHeading")}</h3>
            <p>
              {t("fenceLineItem", {
                lengthFt: String(result.lengthFt),
                material: MATERIALS.find((m) => m.value === result.material)?.label ?? "",
                rate: String(result.rate),
                cost: String(result.bySize),
              })}
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
