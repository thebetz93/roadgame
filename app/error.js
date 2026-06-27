"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    // Surface the error (and its digest) for debugging instead of discarding it.
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#2D3A42",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      padding: 24,
      fontFamily: "'Inter', sans-serif",
      color: "#F5EFE2",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Something went wrong</div>
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: "10px 24px",
          borderRadius: 8,
          border: "none",
          background: "#7CC242",
          color: "#2D3A42",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1,
          cursor: "pointer",
          fontFamily: "'Oswald', sans-serif",
        }}
      >
        TRY AGAIN
      </button>
    </div>
  );
}
