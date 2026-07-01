// Distance, travel-tier, transport-mode, and date helpers shared by both layouts.
import { BRAND } from "./brand";

// Great-circle distance in miles. Returns null if any coordinate is missing so
// callers can distinguish "no location" from "zero miles away".
export function haversine(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

export function fmtDate(iso) { return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
export function fmtTime(iso) { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }

// Human-friendly relative date, e.g. "Today", "Tomorrow", "This Sat", "In 3 wks".
// Returns { text, soon } where soon = within a week. Null for past dates.
export function relInfo(iso) {
  const now = new Date();
  const d = new Date(iso);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((b - a) / 86400000);
  if (days < 0) return null;
  let text;
  if (days === 0) text = "Today";
  else if (days === 1) text = "Tomorrow";
  else if (days < 7) text = `This ${d.toLocaleDateString("en-US", { weekday: "short" })}`;
  else if (days < 14) text = `Next ${d.toLocaleDateString("en-US", { weekday: "short" })}`;
  else if (days < 60) text = `In ${Math.round(days / 7)} wks`;
  else text = `In ${Math.round(days / 30)} mo`;
  return { text, soon: days <= 7 };
}

export function travelTier(d) {
  if (d == null) return { label: "AWAY", color: BRAND.muted, bg: "rgba(154,165,173,0.12)" };
  if (d < 100) return { label: "LOCAL", color: BRAND.green, bg: BRAND.greenGlow };
  if (d < 400) return { label: "ROAD TRIP", color: BRAND.amber, bg: "rgba(242,165,56,0.15)" };
  if (d < 900) return { label: "LONG HAUL", color: "#E87A3A", bg: "rgba(232,122,58,0.15)" };
  return { label: "FLY", color: "#9BB4E8", bg: "rgba(155,180,232,0.15)" };
}

export function modesFor(d) {
  if (d == null) return [];
  // Always offer Drive + Fly for any real distance (Train removed).
  return ["drive", "fly"];
}
