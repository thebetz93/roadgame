"use client";
import { useState } from "react";
import { teamLogoUrl } from "../espn";

// Real team logo from ESPN's CDN, loaded in the user's browser. Falls back to a
// monogram tile (initials on a deterministic color) for college teams and any
// logo that fails to load — so it never shows a broken image.
function initials(team) {
  const parts = team.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function monoColor(team) {
  let h = 0;
  for (let i = 0; i < team.length; i++) h = (h * 31 + team.charCodeAt(i)) % 360;
  return `hsl(${h}, 42%, 30%)`;
}

export default function TeamLogo({ team, league, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const url = teamLogoUrl(team, league);
  const radius = Math.round(size * 0.24);

  if (!url || failed) {
    return (
      <div className="oswald" style={{
        width: size, height: size, borderRadius: radius, background: monoColor(team), color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: Math.round(size * 0.38), flexShrink: 0,
      }}>{initials(team)}</div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, background: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0,
    }}>
      <img
        src={url}
        alt={`${team} logo`}
        width={size - 8}
        height={size - 8}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: size - 8, height: size - 8, objectFit: "contain", display: "block" }}
      />
    </div>
  );
}
