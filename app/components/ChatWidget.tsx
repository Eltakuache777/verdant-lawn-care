"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { useChat } from "./ChatContext";

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
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
            top: 76,
            right: 20,
            width: 320,
            maxHeight: 440,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            zIndex: 1000,
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              padding: 12,
              borderBottom: "1px solid var(--border)",
              fontWeight: 700,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {t("chatTitle")}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{ background: "transparent", color: "var(--text-muted)", padding: "2px 6px", fontWeight: 700 }}
            >
              ✕
            </button>
          </div>

          {!identified ? (
            <form onSubmit={startChat} style={{ padding: 12 }}>
              <label style={{ fontSize: 12 }}>{t("nameLabel")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required style={{ marginBottom: 8 }} />
              <label style={{ fontSize: 12 }}>{t("emailLabel")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ marginBottom: 8 }}
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
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minHeight: 200,
                }}
              >
                {messages.length === 0 && (
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("chatEmptyState")}</p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender === "customer" ? "flex-end" : "flex-start",
                      background: m.sender === "customer" ? "var(--accent)" : "var(--bg-input)",
                      color: m.sender === "customer" ? "#06130c" : "var(--text)",
                      padding: "8px 10px",
                      borderRadius: 8,
                      maxWidth: "80%",
                      minWidth: 0,
                      fontSize: 13,
                      overflowWrap: "break-word",
                      wordBreak: "break-word",
                    }}
                  >
                    <div>{m.body}</div>
                    {m.attachmentUrls && m.attachmentUrls.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                        {m.attachmentUrls.map((url) =>
                          isVideoUrl(url) ? (
                            <video key={url} src={url} controls style={{ width: 100, borderRadius: 4 }} />
                          ) : (
                            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="attachment" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 4 }} />
                            </a>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={sendMessage} style={{ padding: 8, borderTop: "1px solid var(--border)" }}>
                {files.length > 0 && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px" }}>
                    {t("chatFilesAttached", { count: files.length, s: files.length === 1 ? "" : "s" })}
                  </p>
                )}
                <div style={{ display: "flex", gap: 6 }}>
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
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    onChange={(e) => {
                      setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
                      e.target.value = "";
                    }}
                    style={{ display: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    style={{ padding: "8px 10px" }}
                    aria-label={t("chatCameraAria")}
                  >
                    📷
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: "8px 10px" }}
                    aria-label={t("chatAttachAria")}
                  >
                    📎
                  </button>
                  <button type="submit" disabled={sending} style={{ padding: "8px 12px" }}>
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
