"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const searchParams = useSearchParams();
  const isSignup = searchParams.get("mode") === "signup";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Could not send a code.");
        return;
      }
      setCodeSent(true);
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not verify that code.");
        return;
      }
      if (data.role === "admin") window.location.href = "/admin";
      else if (data.role === "worker") window.location.href = "/worker";
      else window.location.href = "/";
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="card">
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>{isSignup ? "Create your account" : "Log in"}</h1>
        <p style={{ color: "var(--text-muted)", marginTop: -4 }}>
          No password needed — we'll email you a one-time code.
        </p>

        {!codeSent ? (
          <form onSubmit={sendCode}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            {isSignup && (
              <>
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </>
            )}
            {error && <p style={{ color: "var(--gold)" }}>{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              We sent a 6-digit code to <strong style={{ color: "var(--text)" }}>{email}</strong>. It expires in
              10 minutes.
            </p>
            <label>Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              required
              style={{ maxWidth: 160, letterSpacing: 4, fontSize: 18, textAlign: "center" }}
            />
            {error && <p style={{ color: "var(--gold)" }}>{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify & continue"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCodeSent(false);
                setCode("");
                setError(null);
              }}
              style={{ background: "transparent", color: "var(--text-muted)", fontWeight: 400, marginTop: 8 }}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main>
          <div className="card">
            <p className="brand-label">Verdant Lawn Care</p>
            <h1>Log in</h1>
          </div>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
