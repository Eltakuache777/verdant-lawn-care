"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/app/components/PasswordInput";
import { useLanguage } from "@/app/components/LanguageProvider";

function LoginContent() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const isSignup = searchParams.get("mode") === "signup";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [useCode, setUseCode] = useState(isSignup); // signups always go through a code
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToRoleHome(role: string) {
    if (role === "admin" || role === "worker") window.location.href = "/admin";
    else window.location.href = "/";
  }

  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("couldNotLogIn"));
        return;
      }
      goToRoleHome(data.role);
    } finally {
      setLoading(false);
    }
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isSignup && password && password !== confirmPassword) {
      setError(t("passwordsDontMatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? t("couldNotSendCode"));
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
    if (isSignup && password && password !== confirmPassword) {
      setError(t("passwordsDontMatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          name: name || undefined,
          phone: phone || undefined,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("couldNotVerifyCode"));
        return;
      }
      goToRoleHome(data.role);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="card">
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>{isSignup ? t("loginCreateAccountTitle") : t("loginTitle")}</h1>

        {!useCode && !isSignup && (
          <form onSubmit={loginWithPassword}>
            <label>{t("emailLabel")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
            <label>{t("passwordLabel")}</label>
            <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" required />
            {error && <p style={{ color: "var(--gold)" }}>{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? t("loggingInBtn") : t("loginBtn")}
            </button>
            <button
              type="button"
              onClick={() => {
                setUseCode(true);
                setError(null);
              }}
              style={{ background: "transparent", color: "var(--text-muted)", fontWeight: 400, marginTop: 8 }}
            >
              {t("loginWithCodeInstead")}
            </button>
          </form>
        )}

        {(useCode || isSignup) && !codeSent && (
          <form onSubmit={sendCode}>
            <p style={{ color: "var(--text-muted)", marginTop: -4 }}>
              {t("loginWillEmailCode")}
              {isSignup ? t("loginToConfirmAddress") : ""}.
            </p>
            <label>{t("emailLabel")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            {isSignup && (
              <>
                <label>{t("nameLabel")}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("yourNamePlaceholder")} required />
                <label>{t("phoneLabel")}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("phoneReachPlaceholder")}
                  required
                />
              </>
            )}
            {error && <p style={{ color: "var(--gold)" }}>{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? t("sendingBtn") : t("sendCodeBtn")}
            </button>
            {!isSignup && (
              <button
                type="button"
                onClick={() => {
                  setUseCode(false);
                  setError(null);
                }}
                style={{ background: "transparent", color: "var(--text-muted)", fontWeight: 400, marginTop: 8 }}
              >
                {t("loginWithPasswordInstead")}
              </button>
            )}
          </form>
        )}

        {(useCode || isSignup) && codeSent && (
          <form onSubmit={verify}>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {t("weSentCodeTo")} <strong style={{ color: "var(--text)" }}>{email}</strong>
              {t("itExpiresIn10")}
            </p>
            <label>{t("codeLabel")}</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              required
              style={{ maxWidth: 160, letterSpacing: 4, fontSize: 18, textAlign: "center" }}
            />
            {isSignup && (
              <>
                <label>{t("createPasswordOptional")}</label>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 6 characters"
                  minLength={6}
                  autoComplete="new-password"
                />
                {password && (
                  <>
                    <label>{t("confirmPasswordLabel")}</label>
                    <PasswordInput value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
                  </>
                )}
              </>
            )}
            {error && <p style={{ color: "var(--gold)" }}>{error}</p>}
            <button type="submit" disabled={loading}>
              {loading ? t("verifyingBtn") : isSignup ? t("verifyCreateAccountBtn") : t("verifyContinueBtn")}
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
              {t("useDifferentEmail")}
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
