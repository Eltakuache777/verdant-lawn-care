"use client";
import { useEffect, useRef, useState } from "react";
import { toDateKey, buildMonthGrid } from "@/lib/calendarGrid";
import { DESIGN_TIERS } from "@/lib/designTiers";

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
  amountPaid: number | null;
  customer: { name: string; email: string; phone: string | null };
};
type ReportData = {
  perService: { name: string; count: number; revenue: number }[];
  totalRevenue: number;
  totalPaidToWorkers: number;
  net: number;
  workerPayments: { id: string; workerEmail: string; workerName: string; amount: number; note: string | null; paidAt: string }[];
};
type Thread = {
  customerEmail: string;
  customerName: string;
  lastMessage: string;
  lastSender: string;
  lastAt: string;
};
type ChatMsg = { id: string; sender: string; body: string; attachmentUrls?: string[]; createdAt: string };
type WorkerRow = { id: string; email: string; name: string | null; addedAt: string };
type View = "schedule" | "messages" | "prices" | "reports" | "design" | "workers";

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)$/i.test(url);
}

const RAIL_ITEMS: { key: View; icon: string; label: string }[] = [
  { key: "schedule", icon: "📅", label: "Schedule" },
  { key: "messages", icon: "💬", label: "Messages" },
  { key: "prices", icon: "💲", label: "Prices" },
  { key: "reports", icon: "📊", label: "Reports" },
  { key: "design", icon: "🎨", label: "Design" },
  { key: "workers", icon: "👥", label: "Workers" },
];
const ADMIN_ONLY_VIEWS: View[] = ["reports", "design", "workers"];

// Shared by /admin (full control) and /worker (same view, everything disabled
// via readOnly — workers can see the whole schedule, all messages, and every
// price, but can't edit a price or send a chat reply).
export default function AdminShell({
  readOnly = false,
  loggedInAs,
}: {
  readOnly?: boolean;
  loggedInAs?: string;
}) {
  const [view, setView] = useState<View>("schedule");

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [materialsStatus, setMaterialsStatus] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string>(() => toDateKey(new Date()));
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [amountPaidDrafts, setAmountPaidDrafts] = useState<Record<string, string>>({});

  const [report, setReport] = useState<ReportData | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [wpWorkerEmail, setWpWorkerEmail] = useState("");
  const [wpAmount, setWpAmount] = useState("");
  const [wpNote, setWpNote] = useState("");
  const [wpSubmitting, setWpSubmitting] = useState(false);

  // Worker (employee) accounts management — add/remove by email.
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [workersError, setWorkersError] = useState<string | null>(null);
  const [newWorkerEmail, setNewWorkerEmail] = useState("");
  const [newWorkerName, setNewWorkerName] = useState("");
  const [addingWorker, setAddingWorker] = useState(false);
  const [addWorkerStatus, setAddWorkerStatus] = useState<string | null>(null);

  // Free AI design generation for the owner — always the highest tier, no Stripe checkout.
  const [designName, setDesignName] = useState("");
  const [designEmail, setDesignEmail] = useState("");
  const [designDescription, setDesignDescription] = useState("");
  const [designFiles, setDesignFiles] = useState<File[]>([]);
  const [designSubmitting, setDesignSubmitting] = useState(false);
  const [designError, setDesignError] = useState<string | null>(null);
  const designFileInputRef = useRef<HTMLInputElement>(null);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [thread, setThread] = useState<ChatMsg[]>([]);
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [sendingReply, setSendingReply] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

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
    if (!readOnly) {
      loadReport();
      loadWorkers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadReport() {
    fetch("/api/reports")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load report");
        return r.json();
      })
      .then(setReport)
      .catch(() => setReportError("Could not load earnings report."));
  }

  function loadWorkers() {
    fetch("/api/workers")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load workers");
        return r.json();
      })
      .then((data: WorkerRow[]) => {
        setWorkers(data);
        if (!wpWorkerEmail && data.length > 0) setWpWorkerEmail(data[0].email);
      })
      .catch(() => setWorkersError("Could not load workers."));
  }

  async function addWorker(e: React.FormEvent) {
    e.preventDefault();
    setAddWorkerStatus(null);
    setAddingWorker(true);
    try {
      const res = await fetch("/api/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newWorkerEmail.trim(), name: newWorkerName.trim() || undefined }),
      });
      if (res.ok) {
        setAddWorkerStatus(`✓ Login code sent to ${newWorkerEmail.trim()}`);
        setNewWorkerEmail("");
        setNewWorkerName("");
        loadWorkers();
      } else {
        const err = await res.json();
        setAddWorkerStatus(err.error ? JSON.stringify(err.error) : "Could not add worker.");
      }
    } finally {
      setAddingWorker(false);
    }
  }

  async function removeWorker(id: string) {
    const res = await fetch(`/api/workers/${id}`, { method: "DELETE" });
    if (res.ok) loadWorkers();
  }

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function markCompleted(id: string) {
    setCompletingId(id);
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)));
      }
    } finally {
      setCompletingId(null);
    }
  }

  async function saveAmountPaid(id: string) {
    const raw = amountPaidDrafts[id];
    const amount = parseFloat(raw);
    if (isNaN(amount) || amount < 0) return;
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountPaid: amount }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)));
      if (!readOnly) loadReport();
    }
  }

  async function submitWorkerPayment(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(wpAmount);
    if (isNaN(amount) || amount <= 0 || !wpWorkerEmail) return;
    setWpSubmitting(true);
    try {
      const res = await fetch("/api/reports/worker-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerEmail: wpWorkerEmail, amount, note: wpNote.trim() || undefined }),
      });
      if (res.ok) {
        setWpAmount("");
        setWpNote("");
        loadReport();
      }
    } finally {
      setWpSubmitting(false);
    }
  }

  async function submitAdminDesign(e: React.FormEvent) {
    e.preventDefault();
    setDesignError(null);
    const photoFiles = designFiles.filter((f) => f.type.startsWith("image/"));
    if (photoFiles.length === 0) {
      setDesignError("Attach at least one photo of the area to redesign.");
      return;
    }
    setDesignSubmitting(true);
    try {
      const formData = new FormData();
      for (const f of designFiles) formData.append("files", f);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        setDesignError(err.error ?? "Could not upload your photos/videos.");
        return;
      }
      const { urls } = await uploadRes.json();

      const genRes = await fetch("/api/design/admin-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: designName,
          customerEmail: designEmail,
          photoUrls: urls,
          description: designDescription,
        }),
      });
      if (!genRes.ok) {
        const err = await genRes.json();
        setDesignError(err.error ? JSON.stringify(err.error) : "Could not start generation.");
        return;
      }
      const { quoteRequestId } = await genRes.json();
      window.location.href = `/design/success?qr=${quoteRequestId}`;
    } finally {
      setDesignSubmitting(false);
    }
  }

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
    if (readOnly || !selectedEmail || (!reply.trim() && replyFiles.length === 0)) return;
    setSendingReply(true);
    try {
      let attachmentUrls: string[] = [];
      if (replyFiles.length > 0) {
        const formData = new FormData();
        for (const f of replyFiles) formData.append("files", f);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          alert(err.error ?? "Could not upload attachments.");
          return;
        }
        attachmentUrls = (await uploadRes.json()).urls;
      }

      const res = await fetch("/api/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: selectedEmail,
          customerName: selectedName,
          body: reply.trim() || "(attached photos/videos)",
          attachmentUrls,
        }),
      });
      if (res.ok) {
        setReply("");
        setReplyFiles([]);
        if (replyFileInputRef.current) replyFileInputRef.current.value = "";
        loadThread(selectedEmail);
        loadThreads();
      }
    } finally {
      setSendingReply(false);
    }
  }

  function updatePrice(name: string, value: string) {
    if (readOnly) return;
    setServices((prev) =>
      prev.map((s) => (s.name === name ? { ...s, basePrice: parseFloat(value) || 0 } : s))
    );
  }

  async function save() {
    if (readOnly) return;
    setStatus("Saving...");
    const res = await fetch("/api/services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: services }),
    });
    setStatus(res.ok ? "✓ Prices saved — live on the Book page now." : "Error saving prices.");
  }

  function updateMaterialPrice(name: string, value: string) {
    if (readOnly) return;
    setMaterials((prev) =>
      prev.map((m) => (m.name === name ? { ...m, price: parseFloat(value) || 0 } : m))
    );
  }

  async function saveMaterials() {
    if (readOnly) return;
    setMaterialsStatus("Saving...");
    const res = await fetch("/api/materials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: materials }),
    });
    setMaterialsStatus(res.ok ? "✓ Prices saved — live on the Materials page now." : "Error saving prices.");
  }

  const bookingsByDay = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = toDateKey(new Date(b.scheduledFor));
    if (!bookingsByDay.has(key)) bookingsByDay.set(key, []);
    bookingsByDay.get(key)!.push(b);
  }
  const selectedDayBookings = (bookingsByDay.get(selectedDay) ?? []).sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
  );

  return (
    <div style={{ display: "flex", height: "calc(100vh - 65px)" }}>
      <div
        style={{
          width: 76,
          flexShrink: 0,
          background: "var(--bg-elevated)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 20,
          gap: 6,
        }}
      >
        {RAIL_ITEMS.filter((item) => !ADMIN_ONLY_VIEWS.includes(item.key) || !readOnly).map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            style={{
              width: 56,
              height: 56,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              background: view === item.key ? "rgba(52,214,127,0.15)" : "transparent",
              color: view === item.key ? "var(--accent)" : "var(--text-muted)",
              border: view === item.key ? "1px solid var(--accent)" : "1px solid transparent",
              borderRadius: 10,
              fontWeight: 400,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 10 }}>{item.label}</span>
          </button>
        ))}
        {readOnly && (
          <p style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center", marginTop: 12, padding: "0 4px" }}>
            View only
          </p>
        )}
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            padding: "8px 20px",
            borderBottom: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-muted)",
            background: "var(--bg-elevated)",
            flexShrink: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            {loggedInAs && (
              <>
                Viewing as <strong style={{ color: "var(--text)" }}>{loggedInAs}</strong>
                {readOnly && " — read only"}
              </>
            )}
          </span>
          <button
            type="button"
            onClick={logOut}
            style={{ background: "transparent", color: "var(--text-muted)", fontWeight: 400, fontSize: 12, padding: "4px 8px" }}
          >
            Log out
          </button>
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          {view === "schedule" && (
          <div style={{ display: "flex", height: "100%" }}>
            <div style={{ width: "50%", borderRight: "1px solid var(--border)", padding: 20, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                >
                  ‹
                </button>
                <strong style={{ fontSize: 16 }}>
                  {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </strong>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                >
                  ›
                </button>
              </div>
              {bookingsError && <p>{bookingsError}</p>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, fontSize: 12, textAlign: "center", color: "var(--text-muted)", marginBottom: 8 }}>
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>
              {buildMonthGrid(calendarMonth).map((week, wi) => (
                <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
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
                          padding: "10px 2px",
                          borderRadius: 8,
                          border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                          background: isSelected ? "rgba(52,214,127,0.15)" : "var(--bg-input)",
                          color: "var(--text)",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 400,
                        }}
                      >
                        <div>{day.getDate()}</div>
                        {dayBookings.length > 0 && (
                          <div style={{ fontSize: 10, color: "var(--gold)" }}>{dayBookings.length} job{dayBookings.length === 1 ? "" : "s"}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ width: "50%", padding: 20, overflowY: "auto" }}>
              <h3 style={{ marginTop: 0 }}>
                {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h3>
              {selectedDayBookings.length === 0 && (
                <p style={{ color: "var(--text-muted)" }}>No appointments this day.</p>
              )}
              {selectedDayBookings.map((b) => (
                <div key={b.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <p style={{ margin: 0 }}>
                    <strong className="accent">
                      {new Date(b.scheduledFor).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })}
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
                    ${b.totalPrice} —{" "}
                    <span style={{ color: b.status === "completed" ? "var(--accent)" : "var(--text-muted)" }}>
                      {b.status === "completed" ? "✓ completed" : b.status}
                    </span>
                  </p>

                  {b.status !== "completed" && (
                    <button
                      type="button"
                      onClick={() => markCompleted(b.id)}
                      disabled={completingId === b.id}
                      style={{ fontSize: 12, padding: "6px 10px", marginTop: 4 }}
                    >
                      {completingId === b.id ? "Marking..." : "Mark completed"}
                    </button>
                  )}

                  {b.status === "completed" && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                      {b.amountPaid != null ? (
                        <p style={{ margin: 0, fontSize: 13 }}>
                          Paid: <strong className="accent">${b.amountPaid}</strong>
                        </p>
                      ) : (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Amount paid"
                            value={amountPaidDrafts[b.id] ?? ""}
                            onChange={(e) => setAmountPaidDrafts((prev) => ({ ...prev, [b.id]: e.target.value }))}
                            style={{ marginBottom: 0, width: 120, fontSize: 12, padding: "6px 8px" }}
                          />
                          <button
                            type="button"
                            onClick={() => saveAmountPaid(b.id)}
                            style={{ fontSize: 12, padding: "6px 10px" }}
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "messages" && (
          <div style={{ display: "flex", height: "100%" }}>
            <div style={{ width: "50%", borderRight: "1px solid var(--border)", padding: 20, overflowY: "auto" }}>
              <h3 style={{ marginTop: 0 }}>Chat</h3>
              {threadsError && <p>{threadsError}</p>}
              {!threadsError && threads.length === 0 && (
                <p style={{ color: "var(--text-muted)" }}>No customer messages yet.</p>
              )}
              {threads.map((t) => (
                <div
                  key={t.customerEmail}
                  onClick={() => openThread(t)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    border: selectedEmail === t.customerEmail ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: selectedEmail === t.customerEmail ? "rgba(52,214,127,0.08)" : "transparent",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 8,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      color: "#06130c",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {t.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{t.customerName}</p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 13,
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {t.lastSender === "admin" ? "You: " : ""}
                      {t.lastMessage}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ width: "50%", display: "flex", flexDirection: "column" }}>
              {!selectedEmail ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  Select a conversation
                </div>
              ) : (
                <>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
                    {selectedName}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
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
                                  <img src={url} alt="attachment" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 4 }} />
                                </a>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {readOnly ? (
                    <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 13 }}>
                      View only — replies are sent by the owner.
                    </div>
                  ) : (
                    <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
                      {replyFiles.length > 0 && (
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px" }}>
                          {replyFiles.length} file{replyFiles.length === 1 ? "" : "s"} attached
                        </p>
                      )}
                      <form onSubmit={sendReply} style={{ display: "flex", gap: 8 }}>
                        <input
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Type a message..."
                          style={{ marginBottom: 0, flex: 1 }}
                        />
                        <input
                          ref={replyFileInputRef}
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          onChange={(e) => setReplyFiles(Array.from(e.target.files ?? []))}
                          style={{ display: "none" }}
                        />
                        <button
                          type="button"
                          onClick={() => replyFileInputRef.current?.click()}
                          style={{ padding: "8px 10px" }}
                          aria-label="Attach photos or videos"
                        >
                          📎
                        </button>
                        <button type="submit" disabled={sendingReply}>
                          Send
                        </button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {view === "prices" && (
          <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
            <div className="card" style={{ margin: "0 0 24px" }}>
              <h1>{readOnly ? "Service prices" : "Edit service prices"}</h1>
              {services.map((s) => (
                <div key={s.name}>
                  <label>{s.name}</label>
                  <input
                    type="number"
                    value={s.basePrice}
                    disabled={readOnly}
                    onChange={(e) => updatePrice(s.name, e.target.value)}
                  />
                </div>
              ))}
              {!readOnly && (
                <>
                  <button onClick={save}>Save prices</button>
                  {status && <p>{status}</p>}
                </>
              )}
            </div>

            <div className="card" style={{ margin: 0 }}>
              <h1>{readOnly ? "Material prices" : "Edit material prices"}</h1>
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
                    disabled={readOnly}
                    onChange={(e) => updateMaterialPrice(m.name, e.target.value)}
                  />
                </div>
              ))}
              {!readOnly && (
                <>
                  <button onClick={saveMaterials}>Save material prices</button>
                  {materialsStatus && <p>{materialsStatus}</p>}
                </>
              )}
            </div>
          </div>
        )}

        {view === "reports" && !readOnly && (
          <div style={{ display: "flex", height: "100%" }}>
            <div style={{ width: "50%", borderRight: "1px solid var(--border)", padding: 20, overflowY: "auto" }}>
              {reportError && <p>{reportError}</p>}
              {!report && !reportError && <p style={{ color: "var(--text-muted)" }}>Loading...</p>}

              {report && (
                <>
                  <h3 style={{ marginTop: 0 }}>Earnings by service</h3>
                  {report.perService.length === 0 && (
                    <p style={{ color: "var(--text-muted)" }}>
                      No completed jobs with a recorded payment yet — mark a job completed and enter what was
                      paid from the Schedule tab.
                    </p>
                  )}
                  {report.perService.map((s) => (
                    <p key={s.name} style={{ display: "flex", justifyContent: "space-between", margin: "6px 0" }}>
                      <span>
                        {s.name} — {s.count} job{s.count === 1 ? "" : "s"}
                      </span>
                      <strong className="accent">${s.revenue.toLocaleString()}</strong>
                    </p>
                  ))}
                  <p style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    <strong>Total revenue</strong>
                    <strong className="accent">${report.totalRevenue.toLocaleString()}</strong>
                  </p>

                  <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                    <p style={{ display: "flex", justifyContent: "space-between", margin: "6px 0" }}>
                      <span>Total revenue</span>
                      <span>${report.totalRevenue.toLocaleString()}</span>
                    </p>
                    <p style={{ display: "flex", justifyContent: "space-between", margin: "6px 0" }}>
                      <span>Total paid to workers</span>
                      <span>-${report.totalPaidToWorkers.toLocaleString()}</span>
                    </p>
                    <p style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 18 }}>
                      <strong>You've made</strong>
                      <strong className="accent">${report.net.toLocaleString()}</strong>
                    </p>
                  </div>
                </>
              )}
            </div>

            <div style={{ width: "50%", padding: 20, overflowY: "auto" }}>
              <h3 style={{ marginTop: 0 }}>Worker payments</h3>
              <form onSubmit={submitWorkerPayment} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 160px" }}>
                  <label>Worker</label>
                  {workers.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Add a worker first.</p>
                  ) : (
                    <select value={wpWorkerEmail} onChange={(e) => setWpWorkerEmail(e.target.value)}>
                      {workers.map((w) => (
                        <option key={w.id} value={w.email}>
                          {w.name || w.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div style={{ flex: "0 1 120px" }}>
                  <label>Amount</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={wpAmount}
                    onChange={(e) => setWpAmount(e.target.value)}
                    required
                  />
                </div>
                <div style={{ flex: "1 1 160px" }}>
                  <label>Note (optional)</label>
                  <input value={wpNote} onChange={(e) => setWpNote(e.target.value)} placeholder="e.g. week of July 28" />
                </div>
                <button type="submit" disabled={wpSubmitting || workers.length === 0} style={{ marginBottom: 14 }}>
                  {wpSubmitting ? "Adding..." : "Log payment"}
                </button>
              </form>

              {report && report.workerPayments.length === 0 && (
                <p style={{ color: "var(--text-muted)" }}>No payments logged yet.</p>
              )}
              {report && report.workerPayments.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {report.workerPayments.map((p) => (
                    <div
                      key={p.id}
                      style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}
                    >
                      <span>
                        {p.workerName}
                        {p.note && <span style={{ color: "var(--text-muted)" }}> — {p.note}</span>}
                        <span style={{ color: "var(--text-muted)" }}> ({new Date(p.paidAt).toLocaleDateString()})</span>
                      </span>
                      <strong>${p.amount.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              )}
              {report && (
                <p style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <strong>Total paid to workers</strong>
                  <strong>${report.totalPaidToWorkers.toLocaleString()}</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {view === "design" && !readOnly && (
          <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
            <div className="card" style={{ margin: 0 }}>
              <h1>Free AI design (owner)</h1>
              <p style={{ color: "var(--text-muted)", marginTop: -8 }}>
                Always runs at the highest tier ({DESIGN_TIERS.highest.concepts}+ concepts) — no charge, no
                checkout.
              </p>
              <form onSubmit={submitAdminDesign}>
                <label>Customer name (who this design is for)</label>
                <input value={designName} onChange={(e) => setDesignName(e.target.value)} required />

                <label>Customer email</label>
                <input type="email" value={designEmail} onChange={(e) => setDesignEmail(e.target.value)} required />

                <label>Describe what you want</label>
                <textarea
                  value={designDescription}
                  onChange={(e) => setDesignDescription(e.target.value)}
                  placeholder="e.g. A stone patio with a fire pit, low-maintenance native plants along the fence..."
                  rows={4}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1.5px solid var(--border)",
                    borderRadius: 6,
                    marginBottom: 14,
                    fontSize: 14,
                    background: "var(--bg-input)",
                    color: "var(--text)",
                    fontFamily: "inherit",
                  }}
                />

                <label>Photos &amp; videos of the area</label>
                <input
                  ref={designFileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => setDesignFiles(Array.from(e.target.files ?? []))}
                />
                {designFiles.length > 0 && (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{designFiles.length} file(s) selected</p>
                )}

                {designError && <p style={{ color: "var(--gold)" }}>{designError}</p>}

                <button type="submit" disabled={designSubmitting}>
                  {designSubmitting ? "Generating..." : "Generate free designs"}
                </button>
              </form>
            </div>
          </div>
        )}

        {view === "workers" && !readOnly && (
          <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
            <div className="card" style={{ margin: 0 }}>
              <h1>Manage workers</h1>
              <p style={{ color: "var(--text-muted)", marginTop: -8 }}>
                Add anyone by their email — they'll get a login code to sign in at /worker. Remove them
                any time to end their access immediately.
              </p>

              <form onSubmit={addWorker} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <label>Email</label>
                  <input
                    type="email"
                    value={newWorkerEmail}
                    onChange={(e) => setNewWorkerEmail(e.target.value)}
                    placeholder="worker@example.com"
                    required
                  />
                </div>
                <div style={{ flex: "1 1 160px" }}>
                  <label>Name (optional)</label>
                  <input value={newWorkerName} onChange={(e) => setNewWorkerName(e.target.value)} placeholder="Their name" />
                </div>
                <button type="submit" disabled={addingWorker} style={{ marginBottom: 14 }}>
                  {addingWorker ? "Adding..." : "Add & send code"}
                </button>
              </form>
              {addWorkerStatus && <p className="accent">{addWorkerStatus}</p>}
              {workersError && <p>{workersError}</p>}

              <div style={{ marginTop: 16 }}>
                {workers.length === 0 && <p style={{ color: "var(--text-muted)" }}>No workers yet.</p>}
                {workers.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 700 }}>{w.name || w.email}</p>
                      {w.name && (
                        <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{w.email}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWorker(w.id)}
                      style={{ background: "transparent", color: "var(--gold)", fontWeight: 600, fontSize: 13 }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
