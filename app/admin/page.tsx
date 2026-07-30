"use client";
import { useEffect, useState } from "react";

type ServiceRow = { name: string; basePrice: number };
type MaterialRow = { name: string; unit: string; price: number };
type Booking = {
  id: string;
  services: string[];
  address: string;
  scheduledFor: string;
  isEmergency: boolean;
  totalPrice: number;
  status: string;
  customer: { name: string; email: string; phone: string | null };
};
type Thread = {
  customerEmail: string;
  customerName: string;
  lastMessage: string;
  lastSender: string;
  lastAt: string;
};
type ChatMsg = { id: string; sender: string; body: string; attachmentUrls?: string[]; createdAt: string };

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)$/i.test(url);
}

function groupByDate(bookings: Booking[]) {
  const groups = new Map<string, Booking[]>();
  for (const b of bookings) {
    const date = new Date(b.scheduledFor).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date)!.push(b);
  }
  return Array.from(groups.entries());
}

export default function AdminPage() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [materialsStatus, setMaterialsStatus] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsError, setBookingsError] = useState<string | null>(null);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [thread, setThread] = useState<ChatMsg[]>([]);
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then(setServices);

    fetch("/api/materials")
      .then((r) => r.json())
      .then(setMaterials);

    fetch("/api/bookings")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load bookings");
        return r.json();
      })
      .then(setBookings)
      .catch(() => setBookingsError("Could not load the schedule."));

    loadThreads();
  }, []);

  function loadThreads() {
    fetch("/api/chat/threads")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load messages");
        return r.json();
      })
      .then(setThreads)
      .catch(() => setThreadsError("Could not load messages."));
  }

  function openThread(t: Thread) {
    setSelectedEmail(t.customerEmail);
    setSelectedName(t.customerName);
    loadThread(t.customerEmail);
  }

  function loadThread(email: string) {
    fetch(`/api/chat?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then(setThread);
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmail || !reply.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch("/api/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerEmail: selectedEmail, customerName: selectedName, body: reply }),
      });
      if (res.ok) {
        setReply("");
        loadThread(selectedEmail);
        loadThreads();
      }
    } finally {
      setSendingReply(false);
    }
  }

  function updatePrice(name: string, value: string) {
    setServices((prev) =>
      prev.map((s) => (s.name === name ? { ...s, basePrice: parseFloat(value) || 0 } : s))
    );
  }

  async function save() {
    setStatus("Saving...");
    const res = await fetch("/api/services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: services }),
    });
    setStatus(res.ok ? "✓ Prices saved — live on the Book page now." : "Error saving prices.");
  }

  function updateMaterialPrice(name: string, value: string) {
    setMaterials((prev) =>
      prev.map((m) => (m.name === name ? { ...m, price: parseFloat(value) || 0 } : m))
    );
  }

  async function saveMaterials() {
    setMaterialsStatus("Saving...");
    const res = await fetch("/api/materials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: materials }),
    });
    setMaterialsStatus(res.ok ? "✓ Prices saved — live on the Materials page now." : "Error saving prices.");
  }

  const grouped = groupByDate(bookings);

  return (
    <main>
      <div className="card">
        <h1>Edit service prices</h1>
        {services.map((s) => (
          <div key={s.name}>
            <label>{s.name}</label>
            <input
              type="number"
              value={s.basePrice}
              onChange={(e) => updatePrice(s.name, e.target.value)}
            />
          </div>
        ))}
        <button onClick={save}>Save prices</button>
        {status && <p>{status}</p>}
      </div>

      <div className="card">
        <h1>Edit material prices</h1>
        <p style={{ color: "var(--text-muted)", marginTop: -8 }}>
          No public API gives real Lowe's/Home Depot prices — update these yourself as they change.
        </p>
        {materials.map((m) => (
          <div key={m.name}>
            <label>
              {m.name} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(per {m.unit})</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={m.price}
              onChange={(e) => updateMaterialPrice(m.name, e.target.value)}
            />
          </div>
        ))}
        <button onClick={saveMaterials}>Save material prices</button>
        {materialsStatus && <p>{materialsStatus}</p>}
      </div>

      <div className="card">
        <h1>Schedule</h1>
        {bookingsError && <p>{bookingsError}</p>}
        {!bookingsError && bookings.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>No appointments booked yet.</p>
        )}
        {grouped.map(([date, dayBookings]) => (
          <div key={date} style={{ marginBottom: 24 }}>
            <h3>{date}</h3>
            {dayBookings
              .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
              .map((b) => (
                <div
                  key={b.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <p style={{ margin: 0 }}>
                    <strong className="accent">
                      {new Date(b.scheduledFor).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "UTC",
                      })}
                    </strong>{" "}
                    — {b.services.join(", ")}
                    {b.isEmergency && " (emergency)"}
                  </p>
                  <p style={{ margin: "4px 0", color: "var(--text-muted)" }}>{b.address}</p>
                  <p style={{ margin: "4px 0", color: "var(--text-muted)", fontSize: 13 }}>
                    {b.customer.name} — {b.customer.email}
                    {b.customer.phone ? ` — ${b.customer.phone}` : ""}
                  </p>
                  <p style={{ margin: "4px 0" }}>
                    ${b.totalPrice} — <span style={{ color: "var(--text-muted)" }}>{b.status}</span>
                  </p>
                </div>
              ))}
          </div>
        ))}
      </div>

      <div className="card">
        <h1>Messages</h1>
        {threadsError && <p>{threadsError}</p>}
        {!threadsError && threads.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>No customer messages yet.</p>
        )}
        {threads.map((t) => (
          <div
            key={t.customerEmail}
            onClick={() => openThread(t)}
            style={{
              border: selectedEmail === t.customerEmail ? "2px solid var(--accent)" : "1px solid var(--border)",
              borderRadius: 8,
              padding: 10,
              marginBottom: 8,
              cursor: "pointer",
            }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>
              {t.customerName} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>{t.customerEmail}</span>
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              {t.lastSender === "admin" ? "You: " : ""}
              {t.lastMessage}
            </p>
          </div>
        ))}

        {selectedEmail && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <h3>{selectedName}</h3>
            <div
              style={{
                maxHeight: 260,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {thread.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.sender === "admin" ? "flex-end" : "flex-start",
                    background: m.sender === "admin" ? "var(--accent)" : "var(--bg-input)",
                    color: m.sender === "admin" ? "#06130c" : "var(--text)",
                    padding: "8px 10px",
                    borderRadius: 8,
                    maxWidth: "80%",
                    fontSize: 13,
                  }}
                >
                  <div>{m.body}</div>
                  {m.attachmentUrls && m.attachmentUrls.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {m.attachmentUrls.map((url) =>
                        isVideoUrl(url) ? (
                          <video key={url} src={url} controls style={{ width: 140, borderRadius: 4 }} />
                        ) : (
                          <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt="attachment"
                              style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 4 }}
                            />
                          </a>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={sendReply} style={{ display: "flex", gap: 8 }}>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply..."
                style={{ marginBottom: 0, flex: 1 }}
              />
              <button type="submit" disabled={sendingReply}>
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
