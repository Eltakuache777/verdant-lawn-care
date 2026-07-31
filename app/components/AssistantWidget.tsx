"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";
import { useAssistant } from "./AssistantContext";

type Msg = { role: "user" | "assistant"; content: string };

export default function AssistantWidget() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { open, setOpen } = useAssistant();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  if (pathname?.startsWith("/admin") || pathname?.startsWith("/worker")) return null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setDraft("");
    setSending(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: t("assistantError") }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: t("assistantError") }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {open && (
        <div
          style={{
            position: "fixed",
            top: 76,
            left: 20,
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
            {t("assistantTitle")}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{ background: "transparent", color: "var(--text-muted)", padding: "2px 6px", fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
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
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("assistantEmptyState")}</p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "var(--accent)" : "var(--bg-input)",
                  color: m.role === "user" ? "#06130c" : "var(--text)",
                  padding: "8px 10px",
                  borderRadius: 8,
                  maxWidth: "85%",
                  minWidth: 0,
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
                }}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: "flex-start", color: "var(--text-muted)", fontSize: 13 }}>
                {t("assistantThinking")}
              </div>
            )}
          </div>
          <form onSubmit={send} style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid var(--border)" }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("assistantPlaceholder")}
              style={{ marginBottom: 0, flex: 1 }}
            />
            <button type="submit" disabled={sending} style={{ padding: "8px 12px" }}>
              {t("chatSend")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
