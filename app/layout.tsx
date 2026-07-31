import "./globals.css";
import ChatWidget from "./components/ChatWidget";

export const metadata = {
  title: "Verdant Lawn Care — Your lawn, handled.",
  description: "Professional mowing, edging & trim for homes right in your neighborhood.",
};

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="50,8 92,88 8,88" fill="none" stroke="#f4f6f2" strokeWidth="5" />
      <polygon points="50,38 78,88 22,88" fill="#34d67f" />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "16px 24px",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <a
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--text)",
              fontWeight: 800,
              letterSpacing: 1,
              textDecoration: "none",
              marginRight: 12,
            }}
          >
            <Logo />
            VERDANT
          </a>
          <a href="/" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            Book
          </a>
          <a href="/estimate/fence" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            Fence Estimate
          </a>
          <a href="/estimate/pressure" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            Pressure Wash Estimate
          </a>
          <a href="/materials" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            Materials
          </a>
          <a href="/design" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            AI Design
          </a>
          <a href="/worker" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            Worker
          </a>
          <a href="/admin" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
            Admin
          </a>
        </nav>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
