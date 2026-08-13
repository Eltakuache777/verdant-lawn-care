"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";
import AddressInput from "./AddressInput";

type CanvassStatus =
  | "not_knocked"
  | "booked"
  | "completed"
  | "denied"
  | "warm_lead"
  | "no_answer"
  | "revisit_am"
  | "revisit_pm";

type House = {
  id: string;
  lat: number;
  lng: number;
  address: string;
  status: CanvassStatus;
  notes: string | null;
  assignedWorkerEmail: string | null;
};
type Territory = {
  id: string;
  name: string | null;
  assignedWorkerEmail: string | null;
  houses: House[];
};
type LeaderboardRow = {
  workerEmail: string;
  workerName: string | null;
  knocks: number;
  booked: number;
  completed: number;
  denied: number;
  conversionRate: number;
};
type WorkerOption = { email: string; name: string | null };

const STATUS_LABELS: Record<CanvassStatus, string> = {
  not_knocked: "Not Knocked",
  booked: "Booked",
  completed: "Completed",
  denied: "Denied",
  warm_lead: "Warm Lead",
  no_answer: "No Answer",
  revisit_am: "Re-visit AM",
  revisit_pm: "Re-visit PM",
};
const STATUS_COLORS: Record<CanvassStatus, string> = {
  not_knocked: "#8a9a90",
  booked: "#34d67f",
  completed: "#2b7fff",
  denied: "#e5484d",
  warm_lead: "#f5a524",
  no_answer: "#b8b8b8",
  revisit_am: "#c084fc",
  revisit_pm: "#a855f7",
};

// Austin, TX -- the business's service area, used to center the map before
// anyone's searched a specific address.
const DEFAULT_CENTER = { lat: 30.2672, lng: -97.7431 };

export default function CanvassView({ workers }: { workers: WorkerOption[] }) {
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [address, setAddress] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [filling, setFilling] = useState(false);
  const [territoryName, setTerritoryName] = useState("");
  const [territoryWorker, setTerritoryWorker] = useState("");

  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const [savingHouse, setSavingHouse] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const clickListenerRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const territoriesRef = useRef<Territory[]>([]);

  // The map is created once and reused for both browsing existing houses
  // and drawing new territories -- no separate map instance per mode, so
  // markers never get orphaned by a div remount.
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapRef.current) return;
    loadGoogleMaps(apiKey).then(() => {
      const google = (window as any).google;
      const map = new google.maps.Map(mapRef.current, { center: DEFAULT_CENTER, zoom: 12, mapTypeId: "roadmap" });
      mapObjRef.current = map;
      setMapReady(true);
    });
  }, []);

  useEffect(() => {
    loadTerritories();
    loadLeaderboard();
  }, []);

  useEffect(() => {
    if (mapReady) renderHouseMarkers(territoriesRef.current);
  }, [mapReady]);

  function loadTerritories() {
    fetch("/api/canvass/territories")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: Territory[]) => {
        setTerritories(data);
        territoriesRef.current = data;
        renderHouseMarkers(data);
      })
      .catch(() => setError("Could not load territories."));
  }

  function loadLeaderboard() {
    fetch("/api/canvass/leaderboard")
      .then((r) => r.json())
      .then(setLeaderboard)
      .catch(() => {});
  }

  function renderHouseMarkers(territoriesData: Territory[]) {
    const google = (window as any).google;
    if (!google || !mapObjRef.current) return;
    for (const marker of markersRef.current.values()) marker.setMap(null);
    markersRef.current.clear();

    for (const territory of territoriesData) {
      for (const house of territory.houses) {
        const marker = new google.maps.Marker({
          position: { lat: house.lat, lng: house.lng },
          map: mapObjRef.current,
          title: house.address,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: STATUS_COLORS[house.status],
            fillOpacity: 1,
            strokeColor: "#0a160f",
            strokeWeight: 1.5,
          },
        });
        marker.addListener("click", () => setSelectedHouse(house));
        markersRef.current.set(house.id, marker);
      }
    }
  }

  async function goToAddress() {
    if (!address) return;
    setLocating(true);
    setError(null);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not locate that address.");
        return;
      }
      mapObjRef.current?.setCenter(data.location);
      mapObjRef.current?.setZoom(17);
    } catch {
      setError("Something went wrong looking up that address.");
    } finally {
      setLocating(false);
    }
  }

  function startDrawing() {
    const google = (window as any).google;
    if (!google || !mapObjRef.current) return;
    setError(null);
    const polygon = new google.maps.Polygon({
      map: mapObjRef.current,
      path: [],
      editable: true,
      fillColor: "#f5a524",
      fillOpacity: 0.2,
      strokeColor: "#f5a524",
      strokeWeight: 2,
    });
    polygonRef.current = polygon;
    setPointCount(0);
    clickListenerRef.current = mapObjRef.current.addListener("click", (e: any) => {
      const path = polygon.getPath();
      path.push(e.latLng);
      setPointCount(path.getLength());
    });
    setDrawing(true);
  }

  function stopDrawing() {
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    clickListenerRef.current?.remove();
    clickListenerRef.current = null;
    setDrawing(false);
    setPointCount(0);
    setTerritoryName("");
    setTerritoryWorker("");
  }

  function clearDrawing() {
    polygonRef.current?.getPath().clear();
    setPointCount(0);
  }

  async function fillHouses() {
    const polygon = polygonRef.current;
    if (!polygon || polygon.getPath().getLength() < 3) {
      setError("Draw a boundary with at least 3 points first.");
      return;
    }
    const path = polygon.getPath();
    const points: { lat: number; lng: number }[] = [];
    for (let i = 0; i < path.getLength(); i++) {
      const pt = path.getAt(i);
      points.push({ lat: pt.lat(), lng: pt.lng() });
    }

    setFilling(true);
    setError(null);
    try {
      const res = await fetch("/api/canvass/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: territoryName.trim() || undefined,
          polygon: points,
          assignedWorkerEmail: territoryWorker || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not fill houses for that area.");
        return;
      }
      stopDrawing();
      loadTerritories();
    } finally {
      setFilling(false);
    }
  }

  async function deleteTerritory(id: string) {
    if (!confirm("Delete this territory and all its houses?")) return;
    await fetch(`/api/canvass/territories/${id}`, { method: "DELETE" });
    loadTerritories();
  }

  async function saveHouse() {
    if (!selectedHouse) return;
    setSavingHouse(true);
    try {
      const res = await fetch(`/api/canvass/houses/${selectedHouse.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selectedHouse.status,
          notes: selectedHouse.notes ?? "",
          assignedWorkerEmail: selectedHouse.assignedWorkerEmail || null,
        }),
      });
      if (res.ok) {
        setSelectedHouse(null);
        loadTerritories();
        loadLeaderboard();
      }
    } finally {
      setSavingHouse(false);
    }
  }

  const totalHouses = territories.reduce((sum, t) => sum + t.houses.length, 0);

  return (
    <div className="admin-view-scroll" style={{ padding: 20 }}>
      <div className="card" style={{ margin: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ margin: 0 }}>Canvassing</h1>
            <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
              {territories.length} {territories.length === 1 ? "territory" : "territories"}, {totalHouses}{" "}
              {totalHouses === 1 ? "house" : "houses"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLeaderboard((v) => !v)}
            style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text)" }}
          >
            {showLeaderboard ? "Hide leaderboard" : "🏆 Leaderboard"}
          </button>
        </div>

        {showLeaderboard && (
          <div style={{ margin: "16px 0", border: "1px solid var(--border)", borderRadius: 8, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)", textAlign: "left" }}>
                  <th style={{ padding: 10 }}>Rep</th>
                  <th style={{ padding: 10 }}>Knocks</th>
                  <th style={{ padding: 10 }}>Booked</th>
                  <th style={{ padding: 10 }}>Completed</th>
                  <th style={{ padding: 10 }}>Denied</th>
                  <th style={{ padding: 10 }}>Conversion</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 14, color: "var(--text-muted)" }}>
                      No door-knocking activity yet.
                    </td>
                  </tr>
                )}
                {leaderboard.map((row, i) => (
                  <tr key={row.workerEmail} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: 10, fontWeight: 700 }}>
                      {i === 0 && "🥇 "}
                      {i === 1 && "🥈 "}
                      {i === 2 && "🥉 "}
                      {row.workerName || row.workerEmail}
                    </td>
                    <td style={{ padding: 10 }}>{row.knocks}</td>
                    <td style={{ padding: 10 }}>{row.booked}</td>
                    <td style={{ padding: 10 }}>{row.completed}</td>
                    <td style={{ padding: 10 }}>{row.denied}</td>
                    <td style={{ padding: 10 }}>{Math.round(row.conversionRate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p style={{ color: "var(--gold)" }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", margin: "16px 0" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ fontSize: 13 }}>Jump to an address</label>
            <AddressInput value={address} onChange={setAddress} />
          </div>
          <button type="button" onClick={goToAddress} disabled={locating || !mapReady} style={{ marginBottom: 16 }}>
            {locating ? "Locating..." : "Go"}
          </button>
          {!drawing ? (
            <button type="button" onClick={startDrawing} disabled={!mapReady} style={{ marginBottom: 16 }}>
              + New Territory
            </button>
          ) : (
            <button
              type="button"
              onClick={stopDrawing}
              style={{ marginBottom: 16, background: "transparent", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              Cancel drawing
            </button>
          )}
        </div>

        {drawing && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Click points on the map to draw the boundary of the area to canvass ({pointCount} point{pointCount === 1 ? "" : "s"} placed)
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <input
                placeholder="Territory name (optional)"
                value={territoryName}
                onChange={(e) => setTerritoryName(e.target.value)}
                style={{ marginBottom: 0, maxWidth: 220 }}
              />
              <select value={territoryWorker} onChange={(e) => setTerritoryWorker(e.target.value)} style={{ marginBottom: 0, maxWidth: 220 }}>
                <option value="">Assign to a rep (optional)</option>
                {workers.map((w) => (
                  <option key={w.email} value={w.email}>
                    {w.name || w.email}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={fillHouses} disabled={pointCount < 3 || filling}>
                {filling ? "Filling houses..." : "Fill houses in this area"}
              </button>
              <button type="button" onClick={clearDrawing} disabled={pointCount === 0}>
                Clear points
              </button>
            </div>
          </div>
        )}

        <div ref={mapRef} style={{ height: 420, width: "100%", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 16 }} />

        <div>
          {territories.map((t) => {
            const counts: Partial<Record<CanvassStatus, number>> = {};
            for (const h of t.houses) counts[h.status] = (counts[h.status] ?? 0) + 1;
            return (
              <div key={t.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{t.name || "Unnamed territory"}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                      {t.houses.length} houses
                      {t.assignedWorkerEmail
                        ? ` — assigned to ${workers.find((w) => w.email === t.assignedWorkerEmail)?.name || t.assignedWorkerEmail}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteTerritory(t.id)}
                    style={{ background: "transparent", color: "var(--gold)", fontWeight: 600, fontSize: 13 }}
                  >
                    Delete
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {(Object.keys(STATUS_LABELS) as CanvassStatus[])
                    .filter((s) => counts[s])
                    .map((s) => (
                      <span
                        key={s}
                        style={{
                          fontSize: 12,
                          padding: "3px 8px",
                          borderRadius: 20,
                          background: STATUS_COLORS[s] + "22",
                          color: STATUS_COLORS[s],
                          fontWeight: 600,
                        }}
                      >
                        {STATUS_LABELS[s]}: {counts[s]}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
          {territories.length === 0 && <p style={{ color: "var(--text-muted)" }}>No territories yet — draw one above to get started.</p>}
        </div>
      </div>

      {selectedHouse && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
          }}
          onClick={() => setSelectedHouse(null)}
        >
          <div className="card" style={{ maxWidth: 420, width: "90%", margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{selectedHouse.address}</h3>
            <label style={{ fontSize: 13 }}>Status</label>
            <select
              value={selectedHouse.status}
              onChange={(e) => setSelectedHouse({ ...selectedHouse, status: e.target.value as CanvassStatus })}
            >
              {(Object.keys(STATUS_LABELS) as CanvassStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 13 }}>Assigned to</label>
            <select
              value={selectedHouse.assignedWorkerEmail ?? ""}
              onChange={(e) => setSelectedHouse({ ...selectedHouse, assignedWorkerEmail: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {workers.map((w) => (
                <option key={w.email} value={w.email}>
                  {w.name || w.email}
                </option>
              ))}
            </select>
            <label style={{ fontSize: 13 }}>Notes</label>
            <textarea
              value={selectedHouse.notes ?? ""}
              onChange={(e) => setSelectedHouse({ ...selectedHouse, notes: e.target.value })}
              rows={3}
              style={{ width: "100%", resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button type="button" onClick={saveHouse} disabled={savingHouse}>
                {savingHouse ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedHouse(null)}
                style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text)" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
