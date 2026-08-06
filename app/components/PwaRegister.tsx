"use client";
import { useEffect } from "react";

// Registers the service worker unconditionally on every page load. The
// existing registration in NotificationPrompt.tsx only fires once someone
// opts into push notifications, which most visitors never do -- a real
// installable PWA (the "Add to Home Screen" prompt) needs an active service
// worker regardless of notification permission.
export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
