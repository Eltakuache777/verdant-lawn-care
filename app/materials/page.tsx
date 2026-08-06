"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/app/components/LanguageProvider";
import type { DictKey } from "@/lib/i18n";

type MaterialRow = { name: string; unit: string; price: number };
type CatalogItem = { id: string; category: string; name: string; description: string | null; imageUrl: string | null };
type Session = { loggedIn: boolean; role?: "admin" | "worker" | "customer" };

const CATEGORIES: { value: string; labelKey: DictKey }[] = [
  { value: "Flowers", labelKey: "categoryFlowers" },
  { value: "Plants", labelKey: "categoryPlants" },
  { value: "Trees", labelKey: "categoryTrees" },
  { value: "Bushes & Hedges", labelKey: "categoryBushesHedges" },
  { value: "Vegetables & Herbs", labelKey: "categoryVegetablesHerbs" },
  { value: "Rocks & Stone", labelKey: "categoryRocksStone" },
  { value: "Mulch", labelKey: "categoryMulch" },
  { value: "Soil", labelKey: "categorySoil" },
];

export default function MaterialsPage() {
  const { t } = useLanguage();
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [session, setSession] = useState<Session | null>(null);

  const [allItems, setAllItems] = useState<CatalogItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [search, setSearch] = useState("");

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);

  const isAdmin = session?.loggedIn && session.role === "admin";

  useEffect(() => {
    fetch("/api/materials")
      .then((r) => r.json())
      .then(setMaterials);
    fetch("/api/material-catalog")
      .then((r) => r.json())
      .then(setAllItems);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => setSession({ loggedIn: false }));
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    loadItems(selectedCategory);
  }, [selectedCategory]);

  function loadItems(category: string) {
    setLoadingItems(true);
    fetch(`/api/material-catalog?category=${encodeURIComponent(category)}`)
      .then((r) => r.json())
      .then(setItems)
      .finally(() => setLoadingItems(false));
  }

  const filteredItems = search.trim()
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          (i.description ?? "").toLowerCase().includes(search.trim().toLowerCase())
      )
    : items;

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory || !newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/material-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          name: newName.trim(),
          description: newDesc.trim() || undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setNewName("");
        setNewDesc("");
        loadItems(selectedCategory);
        setAllItems((prev) => [...prev, created]);
      }
    } finally {
      setAdding(false);
    }
  }

  async function deleteItem(id: string) {
    if (!selectedCategory) return;
    if (!confirm(t("materialsCatalogConfirmDelete"))) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    setAllItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/material-catalog/${id}`, { method: "DELETE" });
  }

  function countFor(category: string) {
    return allItems.filter((i) => i.category === category).length;
  }

  return (
    <main>
      <div className="card" style={{ maxWidth: 700 }}>
        <p className="brand-label">Verdant Lawn Care</p>

        {!selectedCategory ? (
          <>
            <h1>{t("materialsBrowseTitle")}</h1>
            <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 20 }}>
              {t("materialsBrowseSubtitle")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(c.value);
                    setSearch("");
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 14px",
                    background: "transparent",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{t(c.labelKey)}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                    {countFor(c.value)}{" "}
                    {countFor(c.value) === 1 ? t("materialsItemCountSingular") : t("materialsItemCountPlural")}
                  </p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              style={{ background: "transparent", color: "var(--text-muted)", padding: "4px 0", fontWeight: 600, marginBottom: 12 }}
            >
              ← {t("materialsBackToCategories")}
            </button>
            <h1>{t(CATEGORIES.find((c) => c.value === selectedCategory)!.labelKey)}</h1>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("materialsSearchPlaceholder")}
              style={{ marginBottom: 16 }}
            />

            {isAdmin && (
              <form
                onSubmit={addItem}
                style={{
                  border: "1px solid var(--accent)",
                  background: "rgba(52,214,127,0.06)",
                  borderRadius: 10,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <label style={{ fontSize: 12 }}>{t("materialsItemNameLabel")}</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} />
                <label style={{ fontSize: 12 }}>{t("materialsItemDescLabel")}</label>
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                <button type="submit" disabled={adding || !newName.trim()}>
                  {t("materialsItemAddBtn")}
                </button>
              </form>
            )}

            {loadingItems && <p style={{ color: "var(--text-muted)" }}>{t("materialsCatalogLoading")}</p>}
            {!loadingItems && filteredItems.length === 0 && (
              <p style={{ color: "var(--text-muted)" }}>{t("materialsCatalogEmpty")}</p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    position: "relative",
                    display: "flex",
                    gap: 12,
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 14px",
                  }}
                >
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      aria-label="Delete"
                      title="Delete"
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 20,
                        height: 20,
                        padding: 0,
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.4)",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{item.name}</p>
                    {item.description && (
                      <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 18 }}>{t("materialsTitle")}</h2>
          <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 16 }}>{t("materialsSubtitle")}</p>
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
      </div>
    </main>
  );
}
