"use client";
import { useState } from "react";

export default function PasswordInput({
  value,
  onChange,
  placeholder,
  required,
  minLength,
  style,
  autoComplete = "current-password",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  style?: React.CSSProperties;
  autoComplete?: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", ...style }}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        style={{ paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 6,
          top: 8,
          background: "transparent",
          color: "var(--text-muted)",
          padding: "4px 8px",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
