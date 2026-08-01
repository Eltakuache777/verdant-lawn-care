"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageProvider";

type MaterialRow = { name: string; unit: string; price: number };

export default function MaterialsPage() {
  const { t } = useLanguage();
  const [materials, setMaterials] = useState<MaterialRow[]>([]);

  useEffect(() => {
    fetch("/api/materials")
      .then((r) => r.json())
      .then(setMaterials);
  }, []);

  return (
    <main>
      <div className="card">
        <p className="brand-label">Verdant Lawn Care</p>
        <h1>{t("materialsTitle")}</h1>
        <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 20 }}>
          {t("materialsSubtitle")}
        </p>
        {materials.map((m) => (
          <div
            key={m.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span>{m.name}</span>
            <span className="accent" style={{ fontWeight: 700 }}>
              ${m.price.toFixed(2)}
              <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> {t("perUnitPrefix")} {m.unit}</span>
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
