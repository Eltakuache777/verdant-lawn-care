"use client";
import { useRef, useState } from "react";
import { DESIGN_TIERS, DesignTierKey } from "@/lib/designTiers";

export default function DesignPage() {
  const [tier, setTier] = useState<DesignTierKey>("standard");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function startCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const photoFiles = files.filter((f) => f.type.startsWith("image/"));
    if (photoFiles.length === 0) {
      setError("Attach at least one photo of the area you want redesigned.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      for (const f of files) formData.append("files", f);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        setError(err.error ?? "Could not upload your photos/videos.");
        return;
      }
      const { urls } = await uploadRes.json();

      const checkoutRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          customerName: name,
          customerEmail: email,
          photoUrls: urls,
          description,
        }),
      });
      if (!checkoutRes.ok) {
        const err = await checkoutRes.json();
        setError(err.error ?? "Could not start checkout.");
        return;
      }
      const { checkoutUrl } = await checkoutRes.json();
      window.location.href = checkoutUrl;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <div className="card">
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>AI landscaping design concepts</h1>
        <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 20 }}>
          Send a photo of your yard and describe what you want — our AI designer turns it into
          real design concepts you can review. Videos help us understand the space but only
          photos are used to generate designs.
        </p>

        <form onSubmit={startCheckout}>
          <label>Package</label>
          {(Object.keys(DESIGN_TIERS) as DesignTierKey[]).map((key) => {
            const t = DESIGN_TIERS[key];
            return (
              <label
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontWeight: "normal",
                  border: tier === key ? "2px solid var(--accent)" : "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="radio"
                    name="tier"
                    style={{ width: "auto", margin: 0 }}
                    checked={tier === key}
                    onChange={() => setTier(key)}
                  />
                  <span>
                    <strong>{t.label}</strong>
                    <br />
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{t.note}</span>
                  </span>
                </span>
                <span className="accent" style={{ fontWeight: 700 }}>
                  ${t.price}
                </span>
              </label>
            );
          })}

          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />

          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label>Describe what you want</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{files.length} file(s) selected</p>
          )}

          {error && <p style={{ color: "var(--gold)" }}>{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? "Preparing checkout..." : `Continue to payment — $${DESIGN_TIERS[tier].price}`}
          </button>
        </form>
      </div>
    </main>
  );
}
