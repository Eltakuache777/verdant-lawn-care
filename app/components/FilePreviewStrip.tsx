"use client";
import { useEffect, useState } from "react";

// Shows a row of small thumbnails for photos/videos picked but not yet sent,
// each with a remove button — the visual confirmation people expect from
// every messaging app that a photo/video actually got attached.
export default function FilePreviewStrip({
  files,
  onRemove,
}: {
  files: File[];
  onRemove: (index: number) => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
      {files.map((file, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            width: 56,
            height: 56,
            borderRadius: 6,
            overflow: "hidden",
            border: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          {file.type.startsWith("video/") ? (
            <video src={urls[i]} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
          ) : (
            <img src={urls[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="Remove"
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 18,
              height: 18,
              padding: 0,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
