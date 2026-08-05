"use client";
import { useEffect, useRef, useState } from "react";
import { toDateKey, buildMonthGrid } from "@/lib/calendarGrid";
import { DESIGN_TIERS } from "@/lib/designTiers";
import { RECURRING_FREQUENCIES, frequencyLabel } from "@/lib/recurringFrequency";
import PasswordInput from "./PasswordInput";
import FilePreviewStrip from "./FilePreviewStrip";

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
  paymentMethod: string | null;
  amountPaid: number | null;
  assignedWorkerEmail: string | null;
  assignedWorkerName: string | null;
  createdAt: string;
  customer: { name: string; email: string; phone: string | null };
};
type ReportData =
  | {
      role: "admin";
      perService: { name: string; count: number; revenue: number }[];
      totalRevenue: number;
      totalPaidToWorkers: number;
      net: number;
      workerPayments: { id: string; workerEmail: string; workerName: string; amount: number; note: string | null; paidAt: string }[];
    }
  | {
      role: "worker";
      myPayments: { id: string; workerEmail: string; workerName: string; amount: number; note: string | null; paidAt: string }[];
      myTotalPaid: number;
    };
type Thread = {
  customerEmail: string;
  customerName: string;
  lastMessage: string;
  lastSender: string;
  lastAt: string;
};
type ChatMsg = { id: string; sender: string; body: string; attachmentUrls?: string[]; createdAt: string };
type WorkerRow = { id: string; email: string; name: string | null; isAdmin: boolean; addedAt: string };
type RecurringPlan = {
  id: string;
  services: string[];
  address: string;
  frequency: string;
  pricePerVisit: number;
  active: boolean;
  nextDate: string;
};
type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  bookingCount: number;
  totalPaid: number;
  recurringPlan: RecurringPlan | null;
};
type CustomerDetail = CustomerRow & {
  bookings: {
    id: string;
    services: string[];
    address: string;
    scheduledFor: string;
    status: string;
    totalPrice: number;
    amountPaid: number | null;
  }[];
};
type View = "schedule" | "messages" | "prices" | "reports" | "design" | "workers" | "customers" | "team" | "feedback";
type TeamThread = {
  id: string;
  isGroup: boolean;
  name: string;
  memberEmails: string[];
  lastMessage: string;
  lastSenderEmail: string;
  lastAt: string;
};
type TeamMsg = { id: string; senderEmail: string; senderName: string | null; body: string; attachmentUrls: string[]; createdAt: string };
type FeedbackRow = { id: string; message: string; email: string | null; page: string | null; createdAt: string };

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)$/i.test(url);
}

const RAIL_ITEMS: { key: View; icon: string; label: string }[] = [
  { key: "schedule", icon: "📅", label: "Schedule" },
  { key: "messages", icon: "💬", label: "Messages" },
  { key: "team", icon: "🗨️", label: "Team" },
  { key: "customers", icon: "👤", label: "Customers" },
  { key: "prices", icon: "💲", label: "Prices" },
  { key: "reports", icon: "📊", label: "Reports" },
  { key: "design", icon: "🎨", label: "Design" },
  { key: "workers", icon: "👥", label: "Workers" },
  { key: "feedback", icon: "💡", label: "Feedback" },
];
// Shared by /admin and /worker — the owner and workers have equal, full access
// (except reports visibility — see ReportData above).
export default function AdminShell({
  loggedInAs,
  role,
  myEmail,
}: {
  loggedInAs?: string;
  role?: "admin" | "worker";
  myEmail?: string;
}) {
  const [view, setView] = useState<View>("schedule");
  const [newBookingCount, setNewBookingCount] = useState(0);

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

  // Feedback submitted via the customer-facing "Tell us what to improve" button.
  const [feedbackList, setFeedbackList] = useState<FeedbackRow[]>([]);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Customers list + per-customer recurring lawn-care plan / custom pricing.
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [planServices, setPlanServices] = useState("Mowing");
  const [planAddress, setPlanAddress] = useState("");
  const [planFrequency, setPlanFrequency] = useState("biweekly");
  const [planPrice, setPlanPrice] = useState("");
  const [planNextDate, setPlanNextDate] = useState("");
  const [planSaving, setPlanSaving] = useState(false);
  const [planStatus, setPlanStatus] = useState<string | null>(null);

  // Internal staff messaging — 1:1 and group chats among admin/workers.
  const [teamThreads, setTeamThreads] = useState<TeamThread[]>([]);
  const [teamThreadsError, setTeamThreadsError] = useState<string | null>(null);
  const [selectedTeamThreadId, setSelectedTeamThreadId] = useState<string | null>(null);
  const [selectedTeamThreadName, setSelectedTeamThreadName] = useState("");
  const [teamMessages, setTeamMessages] = useState<TeamMsg[]>([]);
  const [teamDraft, setTeamDraft] = useState("");
  const [teamSending, setTeamSending] = useState(false);
  const [teamFiles, setTeamFiles] = useState<File[]>([]);
  const teamFileInputRef = useRef<HTMLInputElement>(null);
  const teamPhotoInputRef = useRef<HTMLInputElement>(null);
  const teamVideoInputRef = useRef<HTMLInputElement>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatEmails, setNewChatEmails] = useState<string[]>([]);
  const [newChatGroupName, setNewChatGroupName] = useState("");
  const [newChatStatus, setNewChatStatus] = useState<string | null>(null);

  // Worker (employee) accounts management — add/remove by email.
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [workersError, setWorkersError] = useState<string | null>(null);
  const [newWorkerEmail, setNewWorkerEmail] = useState("");
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerIsAdmin, setNewWorkerIsAdmin] = useState(false);
  const [addingWorker, setAddingWorker] = useState(false);
  const [addWorkerStatus, setAddWorkerStatus] = useState<string | null>(null);

  // Set/change your own password so you don't need a new email code every time.
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [settingPassword, setSettingPassword] = useState(false);

  // Free AI design generation for the owner — always the highest tier, no Stripe checkout.
  const [designName, setDesignName] = useState("");
  const [designEmail, setDesignEmail] = useState("");
  const [designDescription, setDesignDescription] = useState("");
  const [designFiles, setDesignFiles] = useState<File[]>([]);
  const [designTier, setDesignTier] = useState<"standard" | "better" | "highest">("standard");
  const [designSubmitting, setDesignSubmitting] = useState(false);
  const [designError, setDesignError] = useState<string | null>(null);
  const designFileInputRef = useRef<HTMLInputElement>(null);
  const designPhotoInputRef = useRef<HTMLInputElement>(null);
  const designVideoInputRef = useRef<HTMLInputElement>(null);
  const [myDesignHistory, setMyDesignHistory] = useState<
    { id: string; conceptUrls: string[]; conceptVideoUrls: string[]; createdAt: string; customer: { name: string; email: string } }[]
  >([]);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [thread, setThread] = useState<ChatMsg[]>([]);
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [sendingReply, setSendingReply] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const replyPhotoInputRef = useRef<HTMLInputElement>(null);
  const replyVideoInputRef = useRef<HTMLInputElement>(null);

  const lastSeenBookingRef = useRef<string | null>(null);
  const seenAnyBookingsRef = useRef(false);
  const lastSeenStorageKey = `vlc_lastSeenBooking_${myEmail || "staff"}`;

  function loadBookings(isPoll = false) {
    fetch("/api/bookings")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load bookings");
        return r.json();
      })
      .then((data: Booking[]) => {
        setBookings(data);
        if (!seenAnyBookingsRef.current) {
          // First load: don't notify for bookings that already existed before we started watching.
          seenAnyBookingsRef.current = true;
          const newest = data.reduce((max, b) => (b.createdAt > max ? b.createdAt : max), lastSeenBookingRef.current ?? "");
          if (newest) {
            lastSeenBookingRef.current = newest;
            localStorage.setItem(lastSeenStorageKey, newest);
          }
          return;
        }
        if (!isPoll) return;
        const sinceKey = lastSeenBookingRef.current ?? "";
        const freshOnes = data.filter((b) => b.createdAt > sinceKey);
        if (freshOnes.length > 0) {
          setNewBookingCount((c) => c + freshOnes.length);
          notifyNewBookings(freshOnes);
          const newest = freshOnes.reduce((max, b) => (b.createdAt > max ? b.createdAt : max), sinceKey);
          lastSeenBookingRef.current = newest;
          localStorage.setItem(lastSeenStorageKey, newest);
        }
      })
      .catch(() => setBookingsError("Could not load the schedule."));
  }

  function notifyNewBookings(fresh: Booking[]) {
    const text =
      fresh.length === 1
        ? `New booking: ${fresh[0].customer.name} — ${fresh[0].services.join(", ")}`
        : `${fresh.length} new bookings came in`;
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("Verdant Lawn Care", { body: text });
      } catch {
        // ignore — some webviews (e.g. the Android app) don't support this
      }
    }
  }

  useEffect(() => {
    lastSeenBookingRef.current = localStorage.getItem(lastSeenStorageKey);
    if (lastSeenBookingRef.current) seenAnyBookingsRef.current = true;

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    fetch("/api/services")
      .then((r) => r.json())
      .then(setServices);

    fetch("/api/materials")
      .then((r) => r.json())
      .then(setMaterials);

    loadBookings(false);
    loadThreads();
    loadReport();
    loadWorkers();
    loadCustomers();
    loadTeamThreads();
    loadFeedback();
    fetch("/api/design/history")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setMyDesignHistory(data));
    // Catches up any recurring plans that came due since the app was last opened.
    fetch("/api/recurring/run-due", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.created > 0) {
          loadBookings(false);
          loadCustomers();
        }
      })
      .catch(() => {});

    const interval = setInterval(() => loadBookings(true), 25000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadCustomers() {
    fetch("/api/customers")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load customers");
        return r.json();
      })
      .then(setCustomers)
      .catch(() => setCustomersError("Could not load customers."));
  }

  function loadFeedback() {
    fetch("/api/feedback")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load feedback");
        return r.json();
      })
      .then(setFeedbackList)
      .catch(() => setFeedbackError("Could not load feedback."));
  }

  function openCustomer(id: string) {
    setSelectedCustomerId(id);
    setPlanStatus(null);
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((data: CustomerDetail) => {
        setCustomerDetail(data);
        const plan = data.recurringPlan;
        setPlanServices(plan?.services.join(", ") ?? "Mowing");
        setPlanAddress(plan?.address ?? "");
        setPlanFrequency(plan?.frequency ?? "biweekly");
        setPlanPrice(plan ? String(plan.pricePerVisit) : "");
        setPlanNextDate(plan ? plan.nextDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
      });
  }

  async function saveRecurringPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId) return;
    setPlanStatus(null);
    const price = parseFloat(planPrice);
    if (isNaN(price) || price < 0) {
      setPlanStatus("Enter a valid price.");
      return;
    }
    if (!planAddress.trim()) {
      setPlanStatus("Enter an address.");
      return;
    }
    setPlanSaving(true);
    try {
      const res = await fetch(`/api/customers/${selectedCustomerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services: planServices.split(",").map((s) => s.trim()).filter(Boolean),
          address: planAddress.trim(),
          frequency: planFrequency,
          pricePerVisit: price,
          nextDate: new Date(planNextDate).toISOString(),
        }),
      });
      if (res.ok) {
        setPlanStatus("✓ Recurring plan saved.");
        openCustomer(selectedCustomerId);
        loadCustomers();
      } else {
        const err = await res.json();
        setPlanStatus(err.error ? JSON.stringify(err.error) : "Could not save plan.");
      }
    } finally {
      setPlanSaving(false);
    }
  }

  function loadTeamThreads() {
    fetch("/api/staff-chat/threads")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load team chat");
        return r.json();
      })
      .then(setTeamThreads)
      .catch(() => setTeamThreadsError("Could not load team chat."));
  }

  function openTeamThread(thread: TeamThread) {
    setSelectedTeamThreadId(thread.id);
    setSelectedTeamThreadName(thread.name);
    setNewChatOpen(false);
    setTeamDraft("");
    setTeamFiles([]);
    fetch(`/api/staff-chat/threads/${thread.id}/messages`)
      .then((r) => r.json())
      .then(setTeamMessages);
  }

  async function sendTeamMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTeamThreadId || (!teamDraft.trim() && teamFiles.length === 0)) return;
    setTeamSending(true);
    try {
      let attachmentUrls: string[] = [];
      if (teamFiles.length > 0) {
        const formData = new FormData();
        for (const f of teamFiles) formData.append("files", f);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          alert(err.error ?? "Could not upload attachments.");
          return;
        }
        attachmentUrls = (await uploadRes.json()).urls;
      }

      const res = await fetch(`/api/staff-chat/threads/${selectedTeamThreadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: teamDraft.trim() || "(attached photos/videos)", attachmentUrls }),
      });
      if (res.ok) {
        setTeamDraft("");
        setTeamFiles([]);
        if (teamFileInputRef.current) teamFileInputRef.current.value = "";
        const updated = await fetch(`/api/staff-chat/threads/${selectedTeamThreadId}/messages`).then((r) => r.json());
        setTeamMessages(updated);
        loadTeamThreads();
      }
    } finally {
      setTeamSending(false);
    }
  }

  async function deleteTeamMessage(id: string) {
    if (!selectedTeamThreadId) return;
    if (!confirm("Delete this message for everyone?")) return;
    setTeamMessages((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/staff-chat/threads/${selectedTeamThreadId}/messages/${id}`, { method: "DELETE" });
    loadTeamThreads();
  }

  function toggleNewChatEmail(email: string) {
    setNewChatEmails((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));
  }

  async function createTeamThread(e: React.FormEvent) {
    e.preventDefault();
    if (newChatEmails.length === 0) {
      setNewChatStatus("Pick at least one person.");
      return;
    }
    setNewChatStatus(null);
    const res = await fetch("/api/staff-chat/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberEmails: newChatEmails, name: newChatGroupName.trim() || undefined }),
    });
    if (res.ok) {
      const thread = await res.json();
      setNewChatEmails([]);
      setNewChatGroupName("");
      loadTeamThreads();
      const others = thread.members.filter((m: { workerEmail: string }) => m.workerEmail !== myEmail);
      const displayName =
        thread.name || (thread.isGroup ? others.map((o: { workerName: string | null; workerEmail: string }) => o.workerName || o.workerEmail).join(", ") : others[0]?.workerName || others[0]?.workerEmail);
      openTeamThread({ id: thread.id, isGroup: thread.isGroup, name: displayName, memberEmails: [], lastMessage: "", lastSenderEmail: "", lastAt: "" });
    } else {
      const err = await res.json();
      setNewChatStatus(err.error ? JSON.stringify(err.error) : "Could not start chat.");
    }
  }

  async function cancelRecurringPlan() {
    if (!selectedCustomerId) return;
    const res = await fetch(`/api/customers/${selectedCustomerId}`, { method: "DELETE" });
    if (res.ok) {
      openCustomer(selectedCustomerId);
      loadCustomers();
    }
  }

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
        body: JSON.stringify({
          email: newWorkerEmail.trim(),
          name: newWorkerName.trim() || undefined,
          isAdmin: newWorkerIsAdmin,
        }),
      });
      if (res.ok) {
        setAddWorkerStatus(`✓ Login code sent to ${newWorkerEmail.trim()}`);
        setNewWorkerEmail("");
        setNewWorkerName("");
        setNewWorkerIsAdmin(false);
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

  async function toggleWorkerAdmin(w: WorkerRow) {
    const res = await fetch("/api/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: w.email, name: w.name || undefined, isAdmin: !w.isAdmin }),
    });
    if (res.ok) loadWorkers();
  }

  async function logOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function submitSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordStatus(null);
    if (newPassword.length < 6) {
      setPasswordStatus("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordStatus("New passwords don't match.");
      return;
    }
    setSettingPassword(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPassword || undefined, password: newPassword }),
      });
      if (res.ok) {
        setPasswordStatus("✓ Password set — you can log in with it next time.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        const err = await res.json();
        setPasswordStatus(err.error ?? "Could not set password.");
      }
    } finally {
      setSettingPassword(false);
    }
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

  async function assignWorker(id: string, email: string) {
    const worker = workers.find((w) => w.email === email);
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedWorkerEmail: email || null,
        assignedWorkerName: email ? worker?.name || email : null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)));
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
      loadReport();
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
          tier: designTier,
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
    if (!selectedEmail || (!reply.trim() && replyFiles.length === 0)) return;
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

  async function deleteMessage(id: string) {
    if (!confirm("Delete this message for everyone?")) return;
    setThread((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/chat/${id}`, { method: "DELETE" });
    if (selectedEmail) loadThreads();
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
        {RAIL_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setView(item.key);
              if (item.key === "schedule" && newBookingCount > 0) setNewBookingCount(0);
            }}
            style={{
              position: "relative",
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
            {item.key === "schedule" && newBookingCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  minWidth: 16,
                  height: 16,
                  padding: "0 3px",
                  borderRadius: 8,
                  background: "var(--gold)",
                  color: "#1a1206",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {newBookingCount}
              </span>
            )}
          </button>
        ))}
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
          <div className="admin-split">
            <div className="admin-split-pane admin-split-pane-bordered" style={{ padding: 20, overflowY: "auto" }}>
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

            <div className="admin-split-pane" style={{ padding: 20, overflowY: "auto" }}>
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
                    {b.paymentMethod && (
                      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                        {" "}
                        — pays via {b.paymentMethod[0].toUpperCase() + b.paymentMethod.slice(1)}
                      </span>
                    )}
                  </p>

                  <div style={{ margin: "6px 0", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Assigned to:</span>
                    <select
                      value={b.assignedWorkerEmail ?? ""}
                      onChange={(e) => assignWorker(b.id, e.target.value)}
                      style={{ marginBottom: 0, fontSize: 12, padding: "4px 6px", width: "auto" }}
                    >
                      <option value="">— Unassigned —</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.email}>
                          {w.name || w.email}
                        </option>
                      ))}
                    </select>
                  </div>

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
          <div className="admin-split">
            <div className="admin-split-pane admin-split-pane-bordered" style={{ padding: 20, overflowY: "auto" }}>
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

            <div className="admin-split-pane" style={{ display: "flex", flexDirection: "column", minHeight: 320 }}>
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
                          position: "relative",
                          alignSelf: m.sender === "admin" ? "flex-end" : "flex-start",
                          background: m.sender === "admin" ? "var(--accent)" : "var(--bg-input)",
                          color: m.sender === "admin" ? "#06130c" : "var(--text)",
                          padding: "8px 24px 8px 10px",
                          borderRadius: 8,
                          maxWidth: "80%",
                          minWidth: 0,
                          fontSize: 13,
                          overflowWrap: "break-word",
                          wordBreak: "break-word",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => deleteMessage(m.id)}
                          aria-label="Delete message"
                          title="Delete message"
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            width: 16,
                            height: 16,
                            padding: 0,
                            borderRadius: "50%",
                            background: "rgba(0,0,0,0.25)",
                            color: "inherit",
                            fontSize: 10,
                            fontWeight: 700,
                            lineHeight: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ✕
                        </button>
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
                  <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
                    <FilePreviewStrip files={replyFiles} onRemove={(i) => setReplyFiles((prev) => prev.filter((_, idx) => idx !== i))} />
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
                        onChange={(e) => {
                          const picked = Array.from(e.target.files ?? []);
                          setReplyFiles((prev) => [...prev, ...picked]);
                          e.target.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                      <input
                        ref={replyPhotoInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files ?? []);
                          setReplyFiles((prev) => [...prev, ...picked]);
                          e.target.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                      <input
                        ref={replyVideoInputRef}
                        type="file"
                        accept="video/*"
                        capture="environment"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files ?? []);
                          setReplyFiles((prev) => [...prev, ...picked]);
                          e.target.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => replyPhotoInputRef.current?.click()}
                        style={{ padding: "8px 10px" }}
                        aria-label="Take a photo"
                      >
                        📷
                      </button>
                      <button
                        type="button"
                        onClick={() => replyVideoInputRef.current?.click()}
                        style={{ padding: "8px 10px" }}
                        aria-label="Record a video"
                      >
                        🎥
                      </button>
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
                </>
              )}
            </div>
          </div>
        )}

        {view === "prices" && (
          <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
            <div className="card" style={{ margin: "0 0 24px" }}>
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

            <div className="card" style={{ margin: 0 }}>
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
          </div>
        )}

        {view === "reports" && report?.role === "worker" && (
          <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
            <h3 style={{ marginTop: 0 }}>Your earnings</h3>
            {reportError && <p>{reportError}</p>}
            {report.myPayments.length === 0 && (
              <p style={{ color: "var(--text-muted)" }}>No payments logged for you yet.</p>
            )}
            {report.myPayments.length > 0 && (
              <div style={{ marginTop: 8, maxWidth: 480 }}>
                {report.myPayments.map((p) => (
                  <div
                    key={p.id}
                    style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}
                  >
                    <span>
                      {p.note && <span style={{ color: "var(--text-muted)" }}>{p.note} — </span>}
                      <span style={{ color: "var(--text-muted)" }}>{new Date(p.paidAt).toLocaleDateString()}</span>
                    </span>
                    <strong>${p.amount.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            )}
            <p style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 18, maxWidth: 480 }}>
              <strong>Total earned</strong>
              <strong className="accent">${report.myTotalPaid.toLocaleString()}</strong>
            </p>
          </div>
        )}

        {view === "reports" && (!report || report.role === "admin") && (
          <div className="admin-split">
            <div className="admin-split-pane admin-split-pane-bordered" style={{ padding: 20, overflowY: "auto" }}>
              {reportError && <p>{reportError}</p>}
              {!report && !reportError && <p style={{ color: "var(--text-muted)" }}>Loading...</p>}

              {report && report.role === "admin" && (
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

            <div className="admin-split-pane" style={{ padding: 20, overflowY: "auto" }}>
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

              {report && report.role === "admin" && report.workerPayments.length === 0 && (
                <p style={{ color: "var(--text-muted)" }}>No payments logged yet.</p>
              )}
              {report && report.role === "admin" && report.workerPayments.length > 0 && (
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
              {report && report.role === "admin" && (
                <p style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                  <strong>Total paid to workers</strong>
                  <strong>${report.totalPaidToWorkers.toLocaleString()}</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {view === "team" && (
          <div className="admin-split">
            <div className="admin-split-pane admin-split-pane-bordered" style={{ padding: 20, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>Team chat</h3>
                <button
                  type="button"
                  onClick={() => {
                    setNewChatOpen((v) => !v);
                    setSelectedTeamThreadId(null);
                  }}
                  style={{ fontSize: 12, padding: "6px 10px" }}
                >
                  + New chat
                </button>
              </div>

              {newChatOpen && (
                <form onSubmit={createTeamThread} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
                  <label style={{ fontSize: 12 }}>With</label>
                  {workers.filter((w) => w.email !== myEmail).map((w) => (
                    <label key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: "normal", marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        style={{ width: "auto", margin: 0 }}
                        checked={newChatEmails.includes(w.email)}
                        onChange={() => toggleNewChatEmail(w.email)}
                      />
                      {w.name || w.email}
                    </label>
                  ))}
                  {newChatEmails.length > 1 && (
                    <>
                      <label style={{ fontSize: 12 }}>Group name (optional)</label>
                      <input value={newChatGroupName} onChange={(e) => setNewChatGroupName(e.target.value)} placeholder="e.g. Crew chat" />
                    </>
                  )}
                  {newChatStatus && <p style={{ fontSize: 13 }}>{newChatStatus}</p>}
                  <button type="submit" style={{ fontSize: 12, padding: "6px 10px" }}>
                    Start chat
                  </button>
                </form>
              )}

              {teamThreadsError && <p>{teamThreadsError}</p>}
              {!teamThreadsError && teamThreads.length === 0 && !newChatOpen && (
                <p style={{ color: "var(--text-muted)" }}>No team chats yet — start one above.</p>
              )}
              {teamThreads.map((t) => (
                <div
                  key={t.id}
                  onClick={() => openTeamThread(t)}
                  style={{
                    border: selectedTeamThreadId === t.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: selectedTeamThreadId === t.id ? "rgba(52,214,127,0.08)" : "transparent",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 8,
                    cursor: "pointer",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700 }}>
                    {t.isGroup && "👥 "}
                    {t.name}
                  </p>
                  {t.lastMessage && (
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.lastSenderEmail === myEmail ? "You: " : ""}
                      {t.lastMessage}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="admin-split-pane" style={{ display: "flex", flexDirection: "column", minHeight: 320 }}>
              {!selectedTeamThreadId ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                  Select a chat
                </div>
              ) : (
                <>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontWeight: 700 }}>
                    {selectedTeamThreadName}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                    {teamMessages.map((m) => (
                      <div key={m.id} style={{ alignSelf: m.senderEmail === myEmail ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                        {m.senderEmail !== myEmail && (
                          <p style={{ margin: "0 0 2px", fontSize: 11, color: "var(--text-muted)" }}>{m.senderName || m.senderEmail}</p>
                        )}
                        <div
                          style={{
                            position: "relative",
                            background: m.senderEmail === myEmail ? "var(--accent)" : "var(--bg-input)",
                            color: m.senderEmail === myEmail ? "#06130c" : "var(--text)",
                            padding: "8px 24px 8px 10px",
                            borderRadius: 8,
                            minWidth: 0,
                            fontSize: 13,
                            overflowWrap: "break-word",
                            wordBreak: "break-word",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => deleteTeamMessage(m.id)}
                            aria-label="Delete message"
                            title="Delete message"
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              width: 16,
                              height: 16,
                              padding: 0,
                              borderRadius: "50%",
                              background: "rgba(0,0,0,0.25)",
                              color: "inherit",
                              fontSize: 10,
                              fontWeight: 700,
                              lineHeight: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            ✕
                          </button>
                          {m.body}
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
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
                    <FilePreviewStrip files={teamFiles} onRemove={(i) => setTeamFiles((prev) => prev.filter((_, idx) => idx !== i))} />
                    <form onSubmit={sendTeamMessage} style={{ display: "flex", gap: 8 }}>
                      <input
                        value={teamDraft}
                        onChange={(e) => setTeamDraft(e.target.value)}
                        placeholder="Type a message..."
                        style={{ marginBottom: 0, flex: 1 }}
                      />
                      <input
                        ref={teamFileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={(e) => {
                          const picked = Array.from(e.target.files ?? []);
                          setTeamFiles((prev) => [...prev, ...picked]);
                          e.target.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                      <input
                        ref={teamPhotoInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files ?? []);
                          setTeamFiles((prev) => [...prev, ...picked]);
                          e.target.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                      <input
                        ref={teamVideoInputRef}
                        type="file"
                        accept="video/*"
                        capture="environment"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files ?? []);
                          setTeamFiles((prev) => [...prev, ...picked]);
                          e.target.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => teamPhotoInputRef.current?.click()}
                        style={{ padding: "8px 10px" }}
                        aria-label="Take a photo"
                      >
                        📷
                      </button>
                      <button
                        type="button"
                        onClick={() => teamVideoInputRef.current?.click()}
                        style={{ padding: "8px 10px" }}
                        aria-label="Record a video"
                      >
                        🎥
                      </button>
                      <button
                        type="button"
                        onClick={() => teamFileInputRef.current?.click()}
                        style={{ padding: "8px 10px" }}
                        aria-label="Attach photos or videos"
                      >
                        📎
                      </button>
                      <button type="submit" disabled={teamSending}>
                        Send
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {view === "customers" && (
          <div className="admin-split">
            <div className="admin-split-pane admin-split-pane-bordered" style={{ padding: 20, overflowY: "auto" }}>
              <h3 style={{ marginTop: 0 }}>Customers</h3>
              {customersError && <p>{customersError}</p>}
              {!customersError && customers.length === 0 && (
                <p style={{ color: "var(--text-muted)" }}>No customers yet.</p>
              )}
              {customers.map((c) => (
                <div
                  key={c.id}
                  onClick={() => openCustomer(c.id)}
                  style={{
                    border: selectedCustomerId === c.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: selectedCustomerId === c.id ? "rgba(52,214,127,0.08)" : "transparent",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 8,
                    cursor: "pointer",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700 }}>{c.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                    {c.email}
                    {c.phone ? ` — ${c.phone}` : ""}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    {c.bookingCount} booking{c.bookingCount === 1 ? "" : "s"} — ${c.totalPaid.toLocaleString()} paid
                    {c.recurringPlan?.active && (
                      <span className="accent"> — recurring {frequencyLabel(c.recurringPlan.frequency)}</span>
                    )}
                  </p>
                </div>
              ))}
            </div>

            <div className="admin-split-pane" style={{ padding: 20, overflowY: "auto" }}>
              {!customerDetail ? (
                <p style={{ color: "var(--text-muted)" }}>Select a customer to view details.</p>
              ) : (
                <>
                  <h3 style={{ marginTop: 0 }}>{customerDetail.name}</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: -8 }}>
                    {customerDetail.email}
                    {customerDetail.phone ? ` — ${customerDetail.phone}` : ""}
                  </p>

                  <h4 style={{ marginBottom: 8 }}>Recurring lawn plan</h4>
                  <form onSubmit={saveRecurringPlan}>
                    <label style={{ fontSize: 12 }}>Services (comma-separated)</label>
                    <input value={planServices} onChange={(e) => setPlanServices(e.target.value)} />

                    <label style={{ fontSize: 12 }}>Address</label>
                    <input value={planAddress} onChange={(e) => setPlanAddress(e.target.value)} />

                    <label style={{ fontSize: 12 }}>How often</label>
                    <select value={planFrequency} onChange={(e) => setPlanFrequency(e.target.value)}>
                      {RECURRING_FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>

                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12 }}>Price per visit ($)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={planPrice}
                          onChange={(e) => setPlanPrice(e.target.value)}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12 }}>Next visit date</label>
                        <input type="date" value={planNextDate} onChange={(e) => setPlanNextDate(e.target.value)} />
                      </div>
                    </div>

                    {planStatus && <p style={{ fontSize: 13 }}>{planStatus}</p>}

                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="submit" disabled={planSaving}>
                        {planSaving ? "Saving..." : customerDetail.recurringPlan ? "Update plan" : "Set up plan"}
                      </button>
                      {customerDetail.recurringPlan?.active && (
                        <button
                          type="button"
                          onClick={cancelRecurringPlan}
                          style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                        >
                          Cancel plan
                        </button>
                      )}
                    </div>
                  </form>

                  <h4 style={{ marginTop: 24, marginBottom: 8 }}>Booking history</h4>
                  {customerDetail.bookings.length === 0 && (
                    <p style={{ color: "var(--text-muted)" }}>No bookings yet.</p>
                  )}
                  {customerDetail.bookings.map((b) => (
                    <div key={b.id} style={{ borderBottom: "1px solid var(--border)", padding: "8px 0", fontSize: 13 }}>
                      <p style={{ margin: 0 }}>
                        {new Date(b.scheduledFor).toLocaleDateString("en-US", { timeZone: "UTC" })} — {b.services.join(", ")}
                      </p>
                      <p style={{ margin: "2px 0 0", color: "var(--text-muted)" }}>
                        {b.address} — ${b.totalPrice}
                        {b.amountPaid != null ? ` (paid $${b.amountPaid})` : ` (${b.status})`}
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {view === "design" && (
          <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
            <div className="card" style={{ margin: 0 }}>
              <h1>Free AI design (owner)</h1>
              <p style={{ color: "var(--text-muted)", marginTop: -8 }}>
                No charge, no checkout — but each concept still spends real Stability AI credits, so pick a
                smaller tier for testing and save "Highest" for when you actually want the full set.
              </p>
              <form onSubmit={submitAdminDesign}>
                <label>Customer name (who this design is for)</label>
                <input value={designName} onChange={(e) => setDesignName(e.target.value)} required />

                <label>Customer email</label>
                <input type="email" value={designEmail} onChange={(e) => setDesignEmail(e.target.value)} required />

                <label>Tier (how many concepts to generate)</label>
                <select value={designTier} onChange={(e) => setDesignTier(e.target.value as typeof designTier)}>
                  {(Object.keys(DESIGN_TIERS) as (keyof typeof DESIGN_TIERS)[]).map((key) => (
                    <option key={key} value={key}>
                      {DESIGN_TIERS[key].label} — {DESIGN_TIERS[key].note}
                    </option>
                  ))}
                </select>

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
                <FilePreviewStrip files={designFiles} onRemove={(i) => setDesignFiles((prev) => prev.filter((_, idx) => idx !== i))} />
                <input
                  ref={designFileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    setDesignFiles((prev) => [...prev, ...picked]);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
                <input
                  ref={designPhotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    setDesignFiles((prev) => [...prev, ...picked]);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
                <input
                  ref={designVideoInputRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    setDesignFiles((prev) => [...prev, ...picked]);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button type="button" onClick={() => designPhotoInputRef.current?.click()} aria-label="Take a photo">
                    📷
                  </button>
                  <button type="button" onClick={() => designVideoInputRef.current?.click()} aria-label="Record a video">
                    🎥
                  </button>
                  <button type="button" onClick={() => designFileInputRef.current?.click()} aria-label="Attach photos or videos">
                    📎
                  </button>
                </div>
                {designFiles.length > 0 && (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{designFiles.length} file(s) selected</p>
                )}

                {designError && <p style={{ color: "var(--gold)" }}>{designError}</p>}

                <button type="submit" disabled={designSubmitting}>
                  {designSubmitting ? "Generating..." : "Generate free designs"}
                </button>
              </form>
            </div>

            <div className="card" style={{ margin: "24px 0 0" }}>
              <h1>My AI Designs</h1>
              <p style={{ color: "var(--text-muted)", marginTop: -8 }}>
                Designs you've generated with the free tool — only visible to you, not other workers.
              </p>
              {myDesignHistory.length === 0 && (
                <p style={{ color: "var(--text-muted)" }}>You haven't generated any free designs yet.</p>
              )}
              {myDesignHistory.map((d) => (
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
                      {d.customer.name || d.customer.email}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(d.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      {" — "}
                      {d.conceptUrls.length} concepts
                      {d.conceptVideoUrls.length > 0 ? ` · ${d.conceptVideoUrls.length} videos` : ""}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {view === "workers" && (
          <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
            <div className="card" style={{ margin: "0 0 24px" }}>
              <h1>Your password</h1>
              <p style={{ color: "var(--text-muted)", marginTop: -8 }}>
                Set a password so you can log in without waiting on an email code every time. If you already
                have one, enter it below to change it.
              </p>
              <form onSubmit={submitSetPassword}>
                <label>Current password (leave blank if you haven't set one yet)</label>
                <PasswordInput value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" style={{ marginBottom: 14 }} />
                <label>New password</label>
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  style={{ marginBottom: 14 }}
                />
                <label>Confirm new password</label>
                <PasswordInput
                  value={confirmNewPassword}
                  onChange={setConfirmNewPassword}
                  autoComplete="new-password"
                  style={{ marginBottom: 14 }}
                />
                <button type="submit" disabled={settingPassword}>
                  {settingPassword ? "Saving..." : "Set password"}
                </button>
              </form>
              {passwordStatus && <p className="accent">{passwordStatus}</p>}
            </div>

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
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, marginBottom: 14 }}>
                  <input
                    type="checkbox"
                    style={{ width: "auto", margin: 0 }}
                    checked={newWorkerIsAdmin}
                    onChange={(e) => setNewWorkerIsAdmin(e.target.checked)}
                  />
                  Make admin
                </label>
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
                      <p style={{ margin: 0, fontWeight: 700 }}>
                        {w.name || w.email}
                        {w.isAdmin && (
                          <span className="accent" style={{ fontSize: 11, fontWeight: 700, marginLeft: 8 }}>
                            ADMIN
                          </span>
                        )}
                      </p>
                      {w.name && (
                        <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{w.email}</p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => toggleWorkerAdmin(w)}
                        style={{ background: "transparent", color: "var(--text-muted)", fontWeight: 600, fontSize: 13 }}
                      >
                        {w.isAdmin ? "Remove admin" : "Make admin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeWorker(w.id)}
                        style={{ background: "transparent", color: "var(--gold)", fontWeight: 600, fontSize: 13 }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === "feedback" && (
          <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
            <div className="card" style={{ margin: 0 }}>
              <h1>Feedback</h1>
              <p style={{ color: "var(--text-muted)", marginTop: -8 }}>
                What customers submitted through the "Tell us what to improve" button.
              </p>
              {feedbackError && <p style={{ color: "var(--gold)" }}>{feedbackError}</p>}
              {feedbackList.length === 0 && !feedbackError && (
                <p style={{ color: "var(--text-muted)" }}>No feedback yet.</p>
              )}
              {feedbackList.map((f) => (
                <div
                  key={f.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{f.message}</p>
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(f.createdAt).toLocaleString()}
                    {f.email ? ` — ${f.email}` : ""}
                    {f.page ? ` — ${f.page}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
