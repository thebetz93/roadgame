"use client";
import { BRAND } from "../lib/brand";

// Location picker modal. Presentational — all state/handlers via props.
export default function LocationPicker({ open, setLocPickerOpen, locInput, setLocInput, saveLocPicker, detectLocPicker, locDetecting }) {
  if (!open) return null;
  return (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }} onClick={() => setLocPickerOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 320,
            background: BRAND.slateDark, borderRadius: 12,
            padding: "22px 20px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            border: `1px solid rgba(255,255,255,0.08)`,
          }}>
            <div className="oswald" style={{ fontSize: 15, fontWeight: 700, color: BRAND.cream, marginBottom: 14, letterSpacing: 0.5 }}>
              YOUR LOCATION
            </div>
            <input
              type="text"
              value={locInput}
              onChange={e => setLocInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveLocPicker()}
              placeholder="City, State"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8, marginBottom: 8,
                background: BRAND.slate, border: `1.5px solid rgba(255,255,255,0.12)`,
                color: BRAND.cream, fontSize: 14, outline: "none",
                fontFamily: "'Inter', sans-serif",
              }}
            />
            <button onClick={detectLocPicker} style={{
              width: "100%", padding: "9px", borderRadius: 8, border: `1.5px solid rgba(255,255,255,0.15)`,
              background: "transparent", color: BRAND.muted,
              fontSize: 11, fontWeight: 600, letterSpacing: 1, cursor: "pointer",
              fontFamily: "'Oswald', sans-serif", marginBottom: 8,
            }}>{locDetecting ? "DETECTING..." : "📍 USE MY LOCATION"}</button>
            <button onClick={saveLocPicker} style={{
              width: "100%", padding: "11px", borderRadius: 8, border: "none",
              background: BRAND.green, color: BRAND.charcoal,
              fontSize: 12, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
              fontFamily: "'Oswald', sans-serif",
              boxShadow: `0 4px 0 ${BRAND.greenDark}`,
            }}>SAVE LOCATION →</button>
          </div>
        </div>
  );
}
