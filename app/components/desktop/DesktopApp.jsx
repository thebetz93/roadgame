"use client";
import { useEffect } from "react";
import { BRAND } from "../../lib/brand";
import { SORTED_LEAGUES, TEAMS_BY_LEAGUE } from "../../lib/leagues";
import { haversine, travelTier } from "../../lib/helpers";
import { VENUES } from "../../venues";

// ── Desktop layout (>=1280px). Gated behind DESKTOP_ENABLED / ?desktop=1 until
// the full desktop experience ships. State + handlers come from RoadGame via
// `bag`; presentation lives here. PR3 implements the Browse Teams view; the
// Following / Schedule / Profile views land in later PRs (placeholders below).

function initials(team) {
  const parts = team.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
// Deterministic dark tile color from the team name — variety without a data table.
function monoColor(team) {
  let h = 0;
  for (let i = 0; i < team.length; i++) h = (h * 31 + team.charCodeAt(i)) % 360;
  return `hsl(${h}, 42%, 30%)`;
}

function Header({ bag }) {
  const { view, setView, setActiveTeam, search, setSearch, userCity, user } = bag;
  const inits = ((user?.name || user?.email || "?").trim()[0] || "?").toUpperCase();
  const go = (v) => { setActiveTeam(null); setView(v); };
  const tab = (id, label) => (
    <a onClick={() => go(id)} style={{
      cursor: "pointer", fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 13,
      letterSpacing: 1, padding: "9px 16px", borderRadius: 8,
      background: view === id ? BRAND.green : "transparent",
      color: view === id ? BRAND.charcoal : BRAND.muted,
    }}>{label}</a>
  );
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50, background: "rgba(44,58,66,0.92)",
      backdropFilter: "blur(10px)", borderBottom: `2px solid ${BRAND.green}`,
    }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", gap: 24, padding: "13px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => go("teams")}>
          <div className="oswald" style={{ width: 34, height: 34, borderRadius: 8, background: BRAND.green, color: BRAND.charcoal, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17 }}>▦</div>
          <div className="oswald" style={{ fontWeight: 700, fontSize: 20, letterSpacing: 1 }}>ROADGAME</div>
        </div>
        <nav style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          {tab("following", "FOLLOWING")}
          {tab("teams", "BROWSE TEAMS")}
        </nav>
        <div style={{ flex: 1 }} />
        <div className="oswald" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: BRAND.muted, letterSpacing: 1 }}>
          📍 {(userCity || "SET LOCATION").toUpperCase()}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teams…" style={{
          background: BRAND.slate, border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 8,
          padding: "8px 12px", color: BRAND.cream, fontSize: 13, width: 190, fontFamily: "'Inter',sans-serif", outline: "none",
        }} />
        <div onClick={() => setView("profile")} className="oswald" style={{
          width: 34, height: 34, borderRadius: 8, background: BRAND.slateLight, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13,
        }}>{inits}</div>
      </div>
    </header>
  );
}

function Sidebar({ bag }) {
  const { activeLeague, setActiveLeague, maxDist, setMaxDist, nearbyOnly, setNearbyOnly } = bag;
  const counts = Object.fromEntries(Object.entries(TEAMS_BY_LEAGUE).map(([k, v]) => [k, v.length]));
  return (
    <aside style={{ position: "sticky", top: 92, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: BRAND.slateLight, borderRadius: 14, padding: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
        <h3 className="oswald" style={{ fontSize: 11, letterSpacing: 1.5, color: BRAND.muted, fontWeight: 700, marginBottom: 12 }}>LEAGUES</h3>
        {SORTED_LEAGUES.map(l => (
          <div key={l.id} onClick={() => setActiveLeague(l.id)} className="oswald" style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 9,
            fontWeight: 700, fontSize: 13, letterSpacing: 0.5, cursor: "pointer", marginBottom: 4,
            background: activeLeague === l.id ? BRAND.green : "transparent",
            color: activeLeague === l.id ? BRAND.charcoal : BRAND.muted,
          }}>
            <span style={{ fontSize: 15 }}>{l.emoji}</span> {l.name}
            <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.7 }}>{counts[l.id]}</span>
          </div>
        ))}
      </div>
      <div style={{ background: BRAND.slateLight, borderRadius: 14, padding: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
        <h3 className="oswald" style={{ fontSize: 11, letterSpacing: 1.5, color: BRAND.muted, fontWeight: 700, marginBottom: 12 }}>REACH DISTANCE</h3>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: BRAND.muted, marginBottom: 6 }}>
          <span>Max</span>
          <b className="oswald" style={{ color: BRAND.green }}>{maxDist >= 2500 ? "ANYWHERE" : `≤ ${maxDist} MI`}</b>
        </div>
        <input type="range" min={50} max={2500} step={50} value={maxDist} onChange={e => setMaxDist(Number(e.target.value))} style={{ width: "100%", accentColor: BRAND.green }} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: BRAND.muted, marginTop: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={nearbyOnly} onChange={e => setNearbyOnly(e.target.checked)} style={{ accentColor: BRAND.green }} />
          Reachable teams only
        </label>
      </div>
    </aside>
  );
}

function TeamCard({ team, bag }) {
  const { activeLeague, userLat, userLng, browseLeagueGames, isFollowing, toggleFollow, openSchedule } = bag;
  const venue = VENUES[team];
  const dist = venue ? haversine(userLat, userLng, venue.lat, venue.lng) : null;
  const closest = (browseLeagueGames[activeLeague] ?? {})[team] ?? null;
  const tier = travelTier(dist);
  const fav = isFollowing(team, activeLeague);
  return (
    <div onClick={() => openSchedule(team, activeLeague)} style={{
      background: fav ? "rgba(124,194,66,0.08)" : BRAND.slateLight,
      border: fav ? `1.5px solid ${BRAND.green}` : "1px solid rgba(255,255,255,0.05)",
      borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10, cursor: "pointer",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div className="oswald" style={{ width: 40, height: 40, borderRadius: 10, background: monoColor(team), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{initials(team)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{team}</div>
          <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 1 }}>{venue?.c || ""}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="oswald" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "3px 8px", borderRadius: 5, color: tier.color, background: tier.bg }}>{tier.label}</span>
        <span style={{ fontSize: 11, color: BRAND.muted }}>
          {!browseLeagueGames[activeLeague]
            ? <span style={{ opacity: 0.4 }}>…</span>
            : closest
              ? <>Closest: <b style={{ color: BRAND.cream }}>{closest.city.split(",")[0]} · {closest.dist} mi</b></>
              : dist != null ? <>Home: <b style={{ color: BRAND.cream }}>{dist} mi</b></> : ""}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>VIEW SCHEDULE →</span>
        <button onClick={(e) => { e.stopPropagation(); toggleFollow(team, activeLeague); }} className="oswald" style={{
          border: `1.5px solid ${fav ? BRAND.green : BRAND.muted}`, background: fav ? BRAND.green : "transparent",
          color: fav ? BRAND.charcoal : BRAND.muted, borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer",
        }}>{fav ? "✓ FOLLOWING" : "+ FOLLOW"}</button>
      </div>
    </div>
  );
}

function BrowseView({ bag }) {
  const { activeLeague, search, userLat, userLng, browseLeagueGames, browseLeagueLoading, maxDist, nearbyOnly } = bag;
  const league = SORTED_LEAGUES.find(l => l.id === activeLeague);
  let teams = (TEAMS_BY_LEAGUE[activeLeague] || []).filter(t => t.toLowerCase().includes(search.toLowerCase()));

  const effDist = (t) => {
    const c = (browseLeagueGames[activeLeague] ?? {})[t];
    if (c && c.dist != null) return c.dist;
    const v = VENUES[t];
    return v ? haversine(userLat, userLng, v.lat, v.lng) : null;
  };
  if (nearbyOnly) teams = teams.filter(t => { const d = effDist(t); return d == null || d <= maxDist; });
  teams = [...teams].sort((a, b) => {
    const da = effDist(a), db = effDist(b);
    if (da == null) return 1; if (db == null) return -1;
    return da - db;
  });

  return (
    <main>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
        <h2 className="oswald" style={{ fontSize: 23, fontWeight: 700 }}>BROWSE {league?.name} TEAMS</h2>
        <span style={{ color: BRAND.muted, fontSize: 13 }}>
          {teams.length} team{teams.length === 1 ? "" : "s"}
          {browseLeagueLoading ? " · loading games…" : " · sorted by distance"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(248px,1fr))", gap: 12 }}>
        {teams.map(t => <TeamCard key={t} team={t} bag={bag} />)}
      </div>
    </main>
  );
}

function Placeholder({ title }) {
  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
      <div style={{ textAlign: "center", background: BRAND.slateLight, border: `1px dashed ${BRAND.green}`, borderRadius: 14, padding: "40px 48px" }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🏗️</div>
        <div className="oswald" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>{title}</div>
        <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 6 }}>Desktop version of this screen is coming in the next update.</div>
      </div>
    </main>
  );
}

export default function DesktopApp({ bag }) {
  const { view, activeTeam, setView, toast } = bag;

  // Land the desktop preview on Browse so the league sidebar + grid populate.
  useEffect(() => {
    if (!activeTeam && view !== "teams" && view !== "following" && view !== "profile") setView("teams");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let content;
  if (activeTeam) content = <Placeholder title={activeTeam.team.toUpperCase()} />;         // PR4
  else if (view === "following") content = <Placeholder title="FOLLOWING" />;              // PR5
  else if (view === "profile") content = <Placeholder title="YOUR ACCOUNT" />;             // PR5
  else content = <BrowseView bag={bag} />;

  return (
    <div style={{ minHeight: "100vh", background: BRAND.slate, color: BRAND.cream, fontFamily: "'Inter',sans-serif" }}>
      <Header bag={bag} />
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "26px 24px 60px", display: "grid", gridTemplateColumns: "248px 1fr", gap: 24, alignItems: "start" }}>
        <Sidebar bag={bag} />
        {content}
      </div>
      {toast && (
        <div className="oswald" style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: BRAND.cream, color: BRAND.charcoal, borderRadius: 8, padding: "9px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, zIndex: 100, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", borderLeft: `4px solid ${BRAND.green}` }}>{toast}</div>
      )}
    </div>
  );
}
