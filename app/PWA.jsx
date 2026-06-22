"use client";

import { useEffect, useState } from "react";

// Registers the service worker and shows a one-time iOS "Add to Home Screen"
// hint (Safari has no install button, so users need instructions).
export default function PWA() {
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    const dismissed = localStorage.getItem("roadgame:iosHintDismissed") === "1";

    if (isIOS && !isStandalone && !dismissed) {
      const t = setTimeout(() => setShowIosHint(true), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    setShowIosHint(false);
    try { localStorage.setItem("roadgame:iosHintDismissed", "1"); } catch {}
  }

  if (!showIosHint) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: "fixed", left: 12, right: 12, bottom: 14, zIndex: 9999,
        background: "#37474F", color: "#F5EFE2",
        border: "1px solid rgba(124,194,66,0.4)", borderRadius: 12,
        padding: "12px 14px", boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", gap: 10,
        fontFamily: "'Inter', sans-serif", fontSize: 13, lineHeight: 1.4,
        maxWidth: 560, margin: "0 auto",
      }}
    >
      <span style={{ fontSize: 20 }}>📲</span>
      <div style={{ flex: 1 }}>
        <strong>Install RoadGame</strong> — tap the Share button{" "}
        <span aria-label="share">⎋</span> then <strong>Add to Home Screen</strong>.
      </div>
      <span style={{ fontSize: 16, color: "#9AA5AD", paddingLeft: 4 }}>✕</span>
    </div>
  );
}
