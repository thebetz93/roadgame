"use client";
import { useState } from "react";

// Real vendor logo loaded from a favicon/logo service in the user's browser.
// Falls back through services, then to the original brand-color letter tile if
// none resolve — so it degrades gracefully and never shows a broken image.
export default function VendorLogo({ domain, name, color, size = 30 }) {
  const [step, setStep] = useState(0);
  const sources = [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
  ];
  const radius = size >= 36 ? 8 : 6;

  if (step >= sources.length) {
    return (
      <div className="oswald" style={{
        width: size, height: size, borderRadius: radius, background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size >= 36 ? 14 : 12, fontWeight: 700, flexShrink: 0,
      }}>{name[0]}</div>
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: radius, background: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", flexShrink: 0,
    }}>
      <img
        src={sources[step]}
        alt={`${name} logo`}
        width={size - 8}
        height={size - 8}
        loading="lazy"
        onError={() => setStep(s => s + 1)}
        style={{ width: size - 8, height: size - 8, objectFit: "contain", display: "block" }}
      />
    </div>
  );
}
