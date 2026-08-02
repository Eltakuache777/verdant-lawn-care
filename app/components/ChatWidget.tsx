"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { useChat } from "./ChatContext";
import FilePreviewStrip from "./FilePreviewStrip";

type Msg = { id: string; sender: string; body: string; attachmentUrls?: string[]; createdAt: string };

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)$/i.test(url);
}

export default function ChatWidget() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { open, setOpen } = useChat();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [identified, setIdentified] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedName = localStorage.getItem("chatName");
    const storedEmail = localStorage.getItem("chatEmail");
    if (storedName && storedEmail) {
      setName(storedName);
      setEmail(storedEmail);
      setIdentified(true);
    }
  }, []);

  useEffect(() => {
    if (!identified || !open) return;
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identified, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function loadMessages() {
    const res = await fetch(`/api/chat?email=${encodeURIComponent(email)}`);
    if (res.ok) {
      setMessages(await res.json());
    }
  }

  function startChat(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) return;
    localStorage.setItem("chatName", name);
    localStorage.setItem("chatEmail", email);
    setIdentified(true);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() && files.length === 0) return;
    setSending(true);
    try {
      let attachmentUrls: string[] = [];
      if (files.length > 0) {
        const formData = new FormData();
        for (const f of files) formData.append("files", f);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          alert(err.error ?? t("couldNotUpload"));
          return;
        }
        const uploadData = await uploadRes.json();
        attachmentUrls = uploadData.urls;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: email,
          customerName: name,
          body: draft.trim() || "(attached photos/videos)",
          attachmentUrls,
        }),
      });
      if (res.ok) {
        setDraft("");
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        loadMessages();
      }
    } finally {
      setSending(false);
    }
  }

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/worker")) return null;

  return (
    <>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--bg)",
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              fontWeight: 700,
              fontSize: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexShrink: 0,
              background: "var(--bg-elevated)",
            }}
          >
            {t("chatTitle")}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{ background: "transparent", color: "var(--text-muted)", padding: "4px 10px", fontWeight: 700, fontSize: 20 }}
            >
              ✕
            </button>
          </div>

          {!identified ? (
            <form onSubmit={startChat} style={{ padding: 20, maxWidth: 420, width: "100%", margin: "0 auto" }}>
              <label style={{ fontSize: 13 }}>{t("nameLabel")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required style={{ marginBottom: 10 }} />
              <label style={{ fontSize: 13 }}>{t("emailLabel")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ marginBottom: 10 }}
              />
              <button type="submit" style={{ width: "100%" }}>
                {t("chatStartBtn")}
              </button>
            </form>
          ) : (
            <>
              <div
                ref={listRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "20px max(20px, calc(50% - 340px))",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {messages.length === 0 && (
                  <p style={{ color: "var(--text-muted)", fontSize: 15 }}>{t("chatEmptyState")}</p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender === "customer" ? "flex-end" : "flex-start",
                      background: m.sender === "customer" ? "var(--accent)" : "var(--bg-input)",
                      color: m.sender === "customer" ? "#06130c" : "var(--text)",
                      padding: "12px 14px",
                      borderRadius: 10,
                      maxWidth: "min(80%, 520px)",
                      minWidth: 0,
                      fontSize: 15,
                      overflowWrap: "break-word",
                      wordBreak: "break-word",
                    }}
                  >
                    <div>{m.body}</div>
                    {m.attachmentUrls && m.attachmentUrls.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {m.attachmentUrls.map((url) =>
                          isVideoUrl(url) ? (
                            <video key={url} src={url} controls style={{ width: 160, borderRadius: 6 }} />
                          ) : (
                            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="attachment" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 6 }} />
                            </a>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <form
                onSubmit={sendMessage}
                style={{
                  padding: "12px max(20px, calc(50% - 340px))",
                  borderTop: "1px solid var(--border)",
                  flexShrink: 0,
                  background: "var(--bg-elevated)",
                }}
              >
                <FilePreviewStrip files={files} onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))} />
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t("chatPlaceholder")}
                    style={{ marginBottom: 0, flex: 1 }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => {
                      setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
                      e.target.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
                      e.target.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    capture="environment"
                    onChange={(e) => {
                      setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
                      e.target.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    style={{ padding: "10px 14px" }}
                    aria-label={t("chatCameraAria")}
                  >
                    📷
                  </button>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    style={{ padding: "10px 14px" }}
                    aria-label={t("chatVideoAria")}
                  >
                    🎥
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: "10px 14px" }}
                    aria-label={t("chatAttachAria")}
                  >
                    📎
                  </button>
                  <button type="submit" disabled={sending} style={{ padding: "10px 16px" }}>
                    {t("chatSend")}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
