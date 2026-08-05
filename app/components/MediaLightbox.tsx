"use client";
import { useEffect, useRef, useState } from "react";

export type LightboxItem = { url: string; isVideo: boolean };

// Full-screen viewer with swipe/arrow navigation so people don't have to
// open each photo/video in a new tab and close it to see the next one.
export default function MediaLightbox({
  items,
  startIndex,
  onClose,
  renderExtra,
}: {
  items: LightboxItem[];
  startIndex: number;
  onClose: () => void;
  renderExtra?: (item: LightboxItem, index: number) => React.ReactNode;
}) {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);

  const item = items[index];

  function go(delta: number) {
    setIndex((i) => Math.max(0, Math.min(items.length - 1, i + delta)));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (!item) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 50) go(delta > 0 ? -1 : 1);
        touchStartX.current = null;
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "rgba(255,255,255,0.15)",
          color: "#fff",
          width: 40,
          height: 40,
          borderRadius: "50%",
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        ✕
      </button>

      <p style={{ position: "absolute", top: 20, left: 20, color: "#fff", fontSize: 13, opacity: 0.7 }}>
        {index + 1} / {items.length}
      </p>

      {index > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          aria-label="Previous"
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)",
            color: "#fff",
            width: 44,
            height: 44,
            borderRadius: "50%",
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          ‹
        </button>
      )}
      {index < items.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          aria-label="Next"
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.15)",
            color: "#fff",
            width: 44,
            height: 44,
            borderRadius: "50%",
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          ›
        </button>
      )}

      <div
        style={{ maxWidth: "90vw", maxHeight: "78vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        {item.isVideo ? (
          <video key={item.url} src={item.url} controls autoPlay style={{ maxWidth: "90vw", maxHeight: "78vh", borderRadius: 8 }} />
        ) : (
          <img src={item.url} alt="" style={{ maxWidth: "90vw", maxHeight: "78vh", borderRadius: 8, objectFit: "contain" }} />
        )}
        {renderExtra && renderExtra(item, index)}
      </div>
    </div>
  );
}
