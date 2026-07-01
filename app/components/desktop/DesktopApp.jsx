"use client";
import { useEffect } from "react";
import { BRAND } from "../../lib/brand";
import { LEAGUES, SORTED_LEAGUES, TEAMS_BY_LEAGUE } from "../../lib/leagues";
import { haversine, travelTier, fmtDate, fmtTime, relInfo } from "../../lib/helpers";
import { VENUES } from "../../venues";
import ExpandedPanel from "../ExpandedPanel";
import LogoMark from "../LogoMark";
import AuthModal from "../AuthModal";
import LocationPicker from "../LocationPicker";
import TeamLogo from "../TeamLogo";

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

function Header({ bag, goHome }) {
  const { view, setView, setActiveTeam, search, setSearch, userCity, user, setAuthOpen, setLocInput, setLocPickerOpen } = bag;
  const inits = ((user?.name || user?.email || "?").trim()[0] || "?").toUpperCase();
  const firstName = (user?.name || user?.email || "").split(" ")[0];
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
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", gap: 22, padding: "12px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", cursor: "pointer" }} onClick={goHome} title="Home">
          <LogoMark size={34} />
        </div>
        <nav style={{ display: "flex", gap: 6, marginLeft: 4 }}>
          {tab("following", "FOLLOWING")}
          {tab("teams", "BROWSE TEAMS")}
        </nav>
        <div style={{ flex: 1 }} />
        <button onClick={() => { setLocInput(userCity); setLocPickerOpen(true); }} className="oswald" style={{
          background: "transparent", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: userCity ? BRAND.muted : BRAND.green, letterSpacing: 1,
        }}>📍 {(userCity || "SET LOCATION").toUpperCase()}</button>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teams…" style={{
          background: BRAND.slate, border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 8,
          padding: "8px 12px", color: BRAND.cream, fontSize: 13, width: 180, fontFamily: "'Inter',sans-serif", outline: "none",
        }} />
        {user ? (
          <div onClick={() => setView("profile")} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
            <span className="oswald" style={{ fontSize: 12, color: BRAND.cream, fontWeight: 600, letterSpacing: 0.3, whiteSpace: "nowrap" }}>Welcome, {firstName}</span>
            <div className="oswald" style={{ width: 34, height: 34, borderRadius: 8, background: BRAND.green, color: BRAND.charcoal, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{inits}</div>
          </div>
        ) : (
          <button onClick={() => setAuthOpen(true)} className="oswald" style={{
            background: BRAND.green, color: BRAND.charcoal, border: "none", borderRadius: 8,
            padding: "9px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer", whiteSpace: "nowrap",
          }}>SIGN IN</button>
        )}
      </div>
    </header>
  );
}

// Horizontal Leagues + Game Distance bar — Browse Teams page only. Clicking a
// league always navigates to that league's team grid (never a no-op).
function LeagueBar({ bag }) {
  const { activeLeague, setActiveLeague, setView, setActiveTeam, maxDist, setMaxDist, nearbyOnly, setNearbyOnly } = bag;
  const pickLeague = (id) => { setActiveTeam(null); setActiveLeague(id); setView("teams"); };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span className="oswald" style={{ fontSize: 11, letterSpacing: 1.5, color: BRAND.muted, fontWeight: 700, marginRight: 4 }}>LEAGUES</span>
        {SORTED_LEAGUES.map(l => (
          <button key={l.id} onClick={() => pickLeague(l.id)} className="oswald" style={{
            border: "none", cursor: "pointer", padding: "8px 14px", borderRadius: 8,
            fontWeight: 700, fontSize: 12, letterSpacing: 0.5, whiteSpace: "nowrap",
            background: activeLeague === l.id ? BRAND.green : BRAND.slateLight,
            color: activeLeague === l.id ? BRAND.charcoal : BRAND.muted,
          }}>{l.emoji} {l.name}</button>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: BRAND.slateLight, borderRadius: 10, padding: "9px 14px", border: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="oswald" style={{ fontSize: 11, letterSpacing: 1.5, color: BRAND.muted, fontWeight: 700 }}>GAME DISTANCE</span>
        <input type="range" min={50} max={2500} step={50} value={maxDist} onChange={e => setMaxDist(Number(e.target.value))} style={{ width: 150, accentColor: BRAND.green }} />
        <b className="oswald" style={{ color: BRAND.green, fontSize: 12, minWidth: 78 }}>{maxDist >= 2500 ? "ANYWHERE" : `≤ ${maxDist} MI`}</b>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: BRAND.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={nearbyOnly} onChange={e => setNearbyOnly(e.target.checked)} style={{ accentColor: BRAND.green }} />
          Reachable only
        </label>
      </div>
    </div>
  );
}

function TeamCard({ team, bag, idx = 0 }) {
  const { activeLeague, userLat, userLng, browseLeagueGames, isFollowing, toggleFollow, openSchedule } = bag;
  const venue = VENUES[team];
  const dist = venue ? haversine(userLat, userLng, venue.lat, venue.lng) : null;
  const closest = (browseLeagueGames[activeLeague] ?? {})[team] ?? null;
  const tier = travelTier(dist);
  const fav = isFollowing(team, activeLeague);
  return (
    <div onClick={() => openSchedule(team, activeLeague)} className="d-card d-reveal" style={{
      transitionDelay: `${Math.min(idx, 14) * 30}ms`,
      background: fav ? "rgba(124,194,66,0.08)" : BRAND.slateLight,
      border: fav ? `1.5px solid ${BRAND.green}` : "1px solid rgba(255,255,255,0.05)",
      borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10, cursor: "pointer",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <TeamLogo team={team} league={activeLeague} size={40} />
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
      <LeagueBar bag={bag} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
        <h2 className="oswald" style={{ fontSize: 23, fontWeight: 700 }}>BROWSE {league?.name} TEAMS</h2>
        <span style={{ color: BRAND.muted, fontSize: 13 }}>
          {teams.length} team{teams.length === 1 ? "" : "s"}
          {browseLeagueLoading ? " · loading games…" : " · sorted by distance"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(248px,1fr))", gap: 12 }}>
        {teams.map((t, i) => <TeamCard key={t} team={t} bag={bag} idx={i} />)}
      </div>
    </main>
  );
}

function GameRow({ game, selected, onSelect, idx = 0 }) {
  const tier = travelTier(game.dist);
  const rel = relInfo(game.dateISO);
  return (
    <div onClick={() => onSelect(game.id)} className="d-reveal" style={{
      transitionDelay: `${Math.min(idx, 14) * 30}ms`,
      background: selected ? "rgba(124,194,66,0.10)" : BRAND.slateLight,
      border: `1px solid ${selected ? BRAND.green : "rgba(255,255,255,0.05)"}`,
      borderLeft: `4px solid ${game.isHome ? BRAND.green : BRAND.amber}`,
      borderRadius: 10, padding: "12px 14px", marginBottom: 9, cursor: "pointer",
    }}>
      <div style={{ float: "right", textAlign: "right" }}>
        {game.ticketsFrom != null && <div className="oswald" style={{ color: BRAND.green, fontWeight: 700, fontSize: 15 }}>${game.ticketsFrom}+</div>}
        <div className="oswald" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "2px 6px", borderRadius: 4, marginTop: 4, color: tier.color, background: tier.bg, display: "inline-block" }}>{tier.label}</div>
      </div>
      <div className="oswald" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>{fmtDate(game.dateISO).toUpperCase()} · {fmtTime(game.dateISO)}</span>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "1px 6px", borderRadius: 3, background: game.isHome ? BRAND.green : "rgba(242,165,56,0.2)", color: game.isHome ? BRAND.charcoal : BRAND.amber }}>{game.isHome ? "HOME" : "AWAY"}</span>
        {rel && <span style={{ fontSize: 9, fontWeight: 700, color: rel.soon ? BRAND.amber : BRAND.muted }}>{rel.text.toUpperCase()}</span>}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{game.isHome ? `vs ${game.away}` : `@ ${game.home}`}</div>
      <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2 }}>
        {game.venue} · {game.city}{game.dist != null ? ` · ${game.dist} mi` : ""}
      </div>
    </div>
  );
}

function ScheduleView({ bag }) {
  const {
    activeTeam, setActiveTeam, isFollowing, toggleFollow,
    visibleSchedule, scheduleLoading, scheduleError, reachableCount,
    leagueMeta, maxDist, expanded, setExpanded, travelTab, setTravelTab,
    userCity, showToast,
  } = bag;
  const fav = isFollowing(activeTeam.team, activeTeam.league);
  const selected = visibleSchedule.find(g => g.id === expanded) || visibleSchedule[0] || null;
  const nearest = (() => { const d = visibleSchedule.filter(g => g.dist != null); return d.length ? `${Math.min(...d.map(g => g.dist))}MI` : "—"; })();

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setActiveTeam(null)} className="oswald" style={{ background: BRAND.slateLight, border: "none", borderRadius: 7, padding: "7px 13px", color: BRAND.cream, fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>← BACK</button>
        <TeamLogo team={activeTeam.team} league={activeTeam.league} size={46} />
        <div style={{ flex: 1 }}>
          <div className="oswald" style={{ fontSize: 10, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>{leagueMeta?.emoji} {leagueMeta?.name} · {leagueMeta?.season}</div>
          <div className="oswald" style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.05 }}>{activeTeam.team.toUpperCase()}</div>
        </div>
        <button onClick={() => toggleFollow(activeTeam.team, activeTeam.league)} className="oswald" style={{ background: fav ? BRAND.green : "transparent", border: `1.5px solid ${BRAND.green}`, color: fav ? BRAND.charcoal : BRAND.green, borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>{fav ? "✓ FOLLOWING" : "+ FOLLOW"}</button>
      </div>

      {!scheduleLoading && visibleSchedule.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {[["GAMES", visibleSchedule.length, BRAND.cream], [`WITHIN ${maxDist}MI`, reachableCount, BRAND.green], ["NEAREST", nearest, BRAND.amber]].map(([label, value, accent]) => (
            <div key={label} style={{ flex: 1, background: BRAND.slateLight, borderRadius: 10, padding: "12px 14px" }}>
              <div className="oswald" style={{ fontSize: 10, color: BRAND.muted, letterSpacing: 1.2, fontWeight: 700 }}>{label}</div>
              <div className="oswald" style={{ fontSize: 24, fontWeight: 700, color: accent, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {scheduleLoading && (
        <div style={{ background: BRAND.slateLight, border: `1.5px solid rgba(124,194,66,0.2)`, borderRadius: 12, padding: "40px 20px", textAlign: "center" }}>
          <div className="oswald" style={{ fontSize: 13, color: BRAND.muted, letterSpacing: 2, fontWeight: 700 }}>LOADING SCHEDULE</div>
        </div>
      )}
      {!scheduleLoading && scheduleError && (
        <div style={{ background: BRAND.slateLight, borderRadius: 12, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>📡</div>
          <div className="oswald" style={{ fontSize: 17, fontWeight: 700 }}>SCHEDULE UNAVAILABLE</div>
          <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 6 }}>Couldn't load the schedule right now. Check back in a moment.</div>
        </div>
      )}
      {!scheduleLoading && !scheduleError && visibleSchedule.length === 0 && (
        <div style={{ background: BRAND.slateLight, border: `2px dashed ${BRAND.green}`, borderRadius: 12, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🏟️</div>
          <div className="oswald" style={{ fontSize: 19, fontWeight: 700 }}>COME BACK NEXT SEASON!</div>
          <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 6, maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>{activeTeam.team} doesn't have any upcoming games posted yet.</div>
        </div>
      )}

      {!scheduleLoading && visibleSchedule.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>
          <div>{visibleSchedule.map((g, i) => <GameRow key={g.id} game={g} selected={selected?.id === g.id} onSelect={setExpanded} idx={i} />)}</div>
          <div style={{ position: "sticky", top: 92 }}>
            {selected && (
              <ExpandedPanel game={selected} activeTeam={activeTeam} travelTab={travelTab} setTravelTab={setTravelTab} userCity={userCity} showToast={showToast} />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function FollowingView({ bag }) {
  const { user, following, alerts, alertRadius, setView, setAuthOpen, openSchedule } = bag;

  const teamAlertsFor = (f) => alerts.filter(a => a.team === f.team && a.league === f.league).sort((a, b) => a.dist - b.dist);
  const rank = (f) => { const ta = teamAlertsFor(f); if (ta.some(a => a.isWeek)) return 0; if (ta.length) return 1; return 2; };
  const sorted = [...following].sort((a, b) => rank(a) - rank(b));

  return (
    <main>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
        <h2 className="oswald" style={{ fontSize: 23, fontWeight: 700 }}>
          {user ? `HEY, ${(user.name || user.email || "").split(" ")[0].toUpperCase() || "THERE"}.` : "FOLLOWING"}
        </h2>
        <span style={{ color: BRAND.muted, fontSize: 13 }}>
          {following.length ? `${following.length} team${following.length === 1 ? "" : "s"} · game alerts float to the top` : "Follow teams to see their games near you"}
        </span>
      </div>

      {!user ? (
        <div style={{ background: BRAND.slateLight, border: `2px dashed ${BRAND.green}`, borderRadius: 14, padding: "40px 30px", textAlign: "center", maxWidth: 460 }}>
          <div className="oswald" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>SIGN IN TO FOLLOW TEAMS</div>
          <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 8, marginBottom: 18 }}>Pick your favorites and we'll surface their games near you.</div>
          <button onClick={() => setAuthOpen(true)} className="oswald" style={{ background: BRAND.green, color: BRAND.charcoal, border: "none", borderRadius: 8, padding: "11px 24px", fontSize: 13, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer" }}>SIGN IN →</button>
        </div>
      ) : following.length === 0 ? (
        <div style={{ background: BRAND.slateLight, border: `2px dashed ${BRAND.green}`, borderRadius: 14, padding: "40px 30px", textAlign: "center", maxWidth: 460 }}>
          <div className="oswald" style={{ fontSize: 18, fontWeight: 700 }}>NO TEAMS YET</div>
          <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 8, marginBottom: 18 }}>Head to Browse Teams and follow your favorites.</div>
          <button onClick={() => setView("teams")} className="oswald" style={{ background: BRAND.green, color: BRAND.charcoal, border: "none", borderRadius: 8, padding: "11px 24px", fontSize: 13, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer" }}>BROWSE TEAMS →</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 12 }}>
          {sorted.map((f, i) => {
            const meta = LEAGUES.find(l => l.id === f.league);
            const ta = teamAlertsFor(f);
            const urgent = ta.filter(a => a.isWeek).length;
            return (
              <div key={`${f.team}-${f.league}`} className="d-card d-reveal" style={{
                transitionDelay: `${Math.min(i, 14) * 30}ms`,
                background: BRAND.slateLight, borderRadius: 12,
                borderLeft: `4px solid ${urgent > 0 ? BRAND.red : BRAND.green}`,
                border: "1px solid rgba(255,255,255,0.05)", borderLeftWidth: 4,
                borderLeftColor: urgent > 0 ? BRAND.red : BRAND.green, padding: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <TeamLogo team={f.team} league={f.league} size={34} />
                  <div>
                    <div className="oswald" style={{ fontSize: 10, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>{meta?.emoji} {meta?.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{f.team}</div>
                      {urgent > 0 && <div className="oswald" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, background: BRAND.red, color: "#fff", borderRadius: 4, padding: "2px 6px" }}>● {urgent} THIS WEEK</div>}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 3 }}>
                  {ta.length ? `${ta.length} game${ta.length === 1 ? "" : "s"} within ${alertRadius} mi` : `No games within ${alertRadius} mi in 30 days`}
                </div>
                {ta.slice(0, 3).map((a, i) => (
                  <div key={i} onClick={() => openSchedule(a.team, a.league, a.id)} style={{
                    marginTop: 8, cursor: "pointer",
                    background: a.isWeek ? "rgba(232,69,69,0.08)" : "rgba(242,165,56,0.06)",
                    borderLeft: `3px solid ${a.isWeek ? BRAND.red : BRAND.amber}`,
                    borderRadius: 8, padding: "8px 11px",
                  }}>
                    <div className="oswald" style={{ fontSize: 10, color: a.isWeek ? BRAND.red : BRAND.amber, fontWeight: 700, letterSpacing: 1 }}>
                      {a.isWeek ? "THIS WEEK · " : ""}{fmtDate(a.dateISO).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>{a.isHome ? `vs ${a.away}` : `@ ${a.home}`}</div>
                    <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 1 }}>{a.city} · {a.dist} mi</div>
                  </div>
                ))}
                <button onClick={() => openSchedule(f.team, f.league)} className="oswald" style={{
                  width: "100%", marginTop: 10, padding: "9px", background: "transparent",
                  border: `1.5px solid ${BRAND.green}`, color: BRAND.green, borderRadius: 8,
                  fontSize: 11, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
                }}>VIEW FULL SCHEDULE →</button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: BRAND.slateLight, borderRadius: 14, padding: 18, border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="oswald" style={{ fontSize: 11, letterSpacing: 1.5, color: BRAND.muted, fontWeight: 700, marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function ProfileView({ bag }) {
  const {
    user, userCity, setView, preProfileView, signOut, enablePush, pushGranted,
    editingLocation, setEditingLocation, newCity, setNewCity, setNewCoords,
    saveNewLocation, detectNewLocation,
    alertsEnabled, setAlertsEnabled, alertRadius, setAlertRadius,
    following, alerts, weekAlerts,
  } = bag;
  const hasNotif = typeof window !== "undefined" && "Notification" in window;
  const denied = hasNotif && Notification.permission === "denied";

  return (
    <main style={{ maxWidth: 760 }}>
      <button onClick={() => setView(preProfileView)} className="oswald" style={{ background: BRAND.slateLight, border: "none", borderRadius: 7, padding: "7px 13px", color: BRAND.cream, fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", marginBottom: 18 }}>← BACK</button>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
        <div className="oswald" style={{ width: 62, height: 62, borderRadius: 15, background: BRAND.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: BRAND.charcoal }}>{(user.name || user.email || "?")[0].toUpperCase()}</div>
        <div>
          <div className="oswald" style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.3 }}>{(user.name || user.email || "User").toUpperCase()}</div>
          <div style={{ fontSize: 13, color: BRAND.muted }}>{user.email}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
        <Card title="YOUR LOCATION">
          {!editingLocation ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{userCity}</div>
                <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2 }}>All distances calculated from here</div>
              </div>
              <button onClick={() => { setEditingLocation(true); setNewCity(""); setNewCoords(null); }} className="oswald" style={{ background: "transparent", border: `1.5px solid ${BRAND.green}`, color: BRAND.green, borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>CHANGE</button>
            </div>
          ) : (
            <div>
              <input type="text" value={newCity} onChange={e => { setNewCity(e.target.value); setNewCoords(null); }} placeholder="Charlotte, NC" onKeyDown={e => e.key === "Enter" && saveNewLocation()} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: BRAND.slateDark, border: `1.5px solid rgba(255,255,255,0.1)`, color: BRAND.cream, fontSize: 14, outline: "none", marginBottom: 8, boxSizing: "border-box", fontFamily: "'Inter',sans-serif" }} />
              <button type="button" onClick={detectNewLocation} className="oswald" style={{ background: "transparent", color: BRAND.muted, border: `1px solid ${BRAND.muted}`, borderRadius: 7, padding: "6px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: "pointer", width: "100%", marginBottom: 10 }}>📍 USE MY CURRENT LOCATION</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setEditingLocation(false); setNewCity(""); setNewCoords(null); }} className="oswald" style={{ flex: 1, background: "transparent", border: `1.5px solid ${BRAND.muted}`, color: BRAND.muted, borderRadius: 7, padding: 8, fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>CANCEL</button>
                <button onClick={saveNewLocation} className="oswald" style={{ flex: 1, background: BRAND.green, color: BRAND.charcoal, border: "none", borderRadius: 7, padding: 8, fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>SAVE</button>
              </div>
            </div>
          )}
        </Card>

        <Card title="ALERT SETTINGS">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Weekly alerts</div>
              <div style={{ fontSize: 11, color: BRAND.muted }}>Notify me when teams play nearby</div>
            </div>
            <button onClick={() => setAlertsEnabled(!alertsEnabled)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: alertsEnabled ? BRAND.green : BRAND.slateDark, position: "relative" }}>
              <div style={{ position: "absolute", top: 2, left: alertsEnabled ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: BRAND.cream, transition: "left 0.15s" }} />
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: BRAND.muted }}>Alert radius</span>
            <span className="oswald" style={{ fontSize: 13, fontWeight: 700, color: BRAND.green }}>{alertRadius} MI</span>
          </div>
          <input type="range" min={50} max={1000} step={25} value={alertRadius} onChange={e => setAlertRadius(Number(e.target.value))} disabled={!alertsEnabled} style={{ width: "100%", accentColor: BRAND.green, opacity: alertsEnabled ? 1 : 0.3 }} />
          {alertsEnabled && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid rgba(255,255,255,0.06)` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Push notifications</div>
                  <div style={{ fontSize: 11, color: BRAND.muted }}>{pushGranted ? "Active — morning reminder on game week" : "Get notified even when the app is closed"}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: pushGranted ? BRAND.green : BRAND.muted }}>{pushGranted ? "ON" : "OFF"}</div>
              </div>
              {!pushGranted && hasNotif && !denied && (
                <button onClick={enablePush} className="oswald" style={{ marginTop: 10, width: "100%", padding: 9, background: BRAND.green, color: BRAND.charcoal, border: "none", borderRadius: 7, cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>ENABLE PUSH NOTIFICATIONS</button>
              )}
              {denied && <div style={{ fontSize: 10, color: BRAND.red, marginTop: 8 }}>Notifications blocked in browser settings — enable them to turn this on.</div>}
            </div>
          )}
        </Card>

        <Card title="YOUR STATS">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { value: following.length, label: "TEAMS", accent: BRAND.cream, target: "teams" },
              { value: alerts.length, label: "ALERTS", accent: BRAND.green, target: "following" },
              { value: weekAlerts.length, label: "THIS WEEK", accent: weekAlerts.length > 0 ? BRAND.red : BRAND.cream, target: "following" },
            ].map(({ value, label, accent, target }) => (
              <button key={label} onClick={() => setView(target)} style={{ background: BRAND.slateDark, borderRadius: 8, padding: "10px 12px", border: "none", cursor: "pointer", textAlign: "left" }}>
                <div className="oswald" style={{ fontSize: 9, color: BRAND.muted, letterSpacing: 1.2, fontWeight: 700 }}>{label}</div>
                <div className="oswald" style={{ fontSize: 22, fontWeight: 700, color: accent, marginTop: 2 }}>{value}</div>
              </button>
            ))}
          </div>
        </Card>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button onClick={signOut} className="oswald" style={{ width: "100%", padding: 13, borderRadius: 8, border: `1.5px solid ${BRAND.red}`, background: "transparent", color: BRAND.red, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer" }}>SIGN OUT</button>
        </div>
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

function HomeView({ bag }) {
  const { user, setView, setActiveTeam, setAuthOpen } = bag;
  const browse = () => { setActiveTeam(null); setView("teams"); };
  const features = [
    { icon: "📍", title: "Games near you", body: "Every pro & college game sorted by real distance from your city — local, road trip, long haul, or fly." },
    { icon: "🎟️", title: "Compare tickets", body: "See the lowest prices across SeatGeek, Ticketmaster, and more, side by side for each game." },
    { icon: "🧭", title: "Plan the whole trip", body: "Drive or fly estimates, hotels near the venue, and a local eat/drink/see city guide." },
  ];
  return (
    <div>
      <section style={{ padding: "64px 0 40px", maxWidth: 780 }}>
        <div className="oswald" style={{ fontSize: 12, letterSpacing: 2, color: BRAND.green, fontWeight: 700, marginBottom: 14 }}>PRO &amp; COLLEGE SPORTS ROAD TRIPS</div>
        <h1 className="oswald" style={{ fontSize: 52, fontWeight: 700, letterSpacing: -1, lineHeight: 1.02 }}>
          Your team,<br /><span style={{ color: BRAND.green }}>near you.</span>
        </h1>
        <p style={{ fontSize: 17, color: BRAND.muted, marginTop: 16, lineHeight: 1.5, maxWidth: 560 }}>
          RoadGame finds the games within reach of your city, compares ticket prices, and helps you plan the trip — so you can go see them live.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
          <button onClick={browse} className="oswald" style={{ background: BRAND.green, color: BRAND.charcoal, border: "none", borderRadius: 10, padding: "14px 28px", fontSize: 14, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>BROWSE TEAMS →</button>
          {user
            ? <button onClick={() => setView("following")} className="oswald" style={{ background: "transparent", color: BRAND.cream, border: `1.5px solid ${BRAND.muted}`, borderRadius: 10, padding: "14px 28px", fontSize: 14, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>MY FOLLOWING</button>
            : <button onClick={() => setAuthOpen(true)} className="oswald" style={{ background: "transparent", color: BRAND.cream, border: `1.5px solid ${BRAND.muted}`, borderRadius: 10, padding: "14px 28px", fontSize: 14, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>SIGN IN</button>}
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: 34, color: BRAND.muted, fontSize: 13 }}>
          <div><b className="oswald" style={{ color: BRAND.cream, fontSize: 20 }}>5</b> leagues</div>
          <div><b className="oswald" style={{ color: BRAND.cream, fontSize: 20 }}>180+</b> teams</div>
          <div><b className="oswald" style={{ color: BRAND.cream, fontSize: 20 }}>NFL · CFB · MLB · NBA · NHL</b></div>
        </div>
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16, paddingBottom: 40 }}>
        {features.map((f, i) => (
          <div key={f.title} className="d-card d-reveal" style={{ transitionDelay: `${i * 80}ms`, background: BRAND.slateLight, border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: 22 }}>
            <div style={{ fontSize: 26 }}>{f.icon}</div>
            <div className="oswald" style={{ fontSize: 16, fontWeight: 700, marginTop: 10, letterSpacing: 0.3 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 6, lineHeight: 1.5 }}>{f.body}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

// Reveal-on-scroll: fade/rise elements as they enter the viewport. Re-runs when
// the content key changes so newly-rendered items get observed. Fully disabled
// under prefers-reduced-motion.
function useScrollReveal(contentKey) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = document.querySelectorAll(".d-reveal:not(.in)");
    if (!("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, [contentKey]);
}

const DESKTOP_CSS = `
  @keyframes dDrift { from { transform: translate(0,0) scale(1); } to { transform: translate(-4%,-3%) scale(1.06); } }
  @keyframes dFade  { from { opacity: 0; } to { opacity: 1; } }
  .d-app { position: relative; }
  .d-app::before { content:''; position: fixed; inset: -25%; z-index: 0; pointer-events: none;
    background:
      radial-gradient(38% 38% at 18% 22%, rgba(124,194,66,.10), transparent 70%),
      radial-gradient(32% 32% at 84% 68%, rgba(124,194,66,.06), transparent 72%),
      radial-gradient(30% 30% at 60% 100%, rgba(155,180,232,.05), transparent 70%); }
  .d-layer { position: relative; z-index: 1; }
  .d-card { transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
  .d-fade { animation: dFade .3s ease both; }
  @media (prefers-reduced-motion: no-preference) {
    .d-app::before { animation: dDrift 30s ease-in-out infinite alternate; }
    .d-reveal { opacity: 0; transform: translateY(18px);
      transition: opacity .6s cubic-bezier(.22,1,.36,1), transform .6s cubic-bezier(.22,1,.36,1); }
    .d-reveal.in { opacity: 1; transform: none; }
    .d-card:hover { transform: translateY(-4px); box-shadow: 0 14px 34px rgba(0,0,0,.28); }
  }
`;

export default function DesktopApp({ bag }) {
  const { view, activeTeam, setView, toast, user } = bag;
  const KNOWN = ["home", "teams", "following", "profile"];

  // Signed-out visitors land on the Home page; keep any unknown view sane.
  useEffect(() => {
    if (activeTeam) return;
    if (!user && (view === "following" || view === "profile")) setView("home");
    else if (!KNOWN.includes(view)) setView("teams");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once signed in, don't strand the user on the marketing Home page.
  useEffect(() => {
    if (user && view === "home") setView("following");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const goHome = () => { bag.setActiveTeam(null); setView("home"); };

  // View key drives the fade on navigation. Reveal key ALSO changes when async
  // content lands (schedule finishing loading, browse games arriving) so the
  // reveal observer re-runs and picks up rows that render after the initial
  // paint — otherwise they'd stay stuck at opacity 0.
  const viewKey = `${view}:${activeTeam?.team || ""}:${bag.activeLeague}`;
  const revealKey = `${viewKey}:${bag.scheduleLoading ? "L" : "R"}:${bag.visibleSchedule?.length ?? 0}:${bag.browseLeagueGames?.[bag.activeLeague] ? "B" : ""}`;
  useScrollReveal(revealKey);

  let content;
  if (activeTeam) content = <ScheduleView bag={bag} />;
  else if (view === "home") content = <HomeView bag={bag} />;
  else if (view === "following") content = <FollowingView bag={bag} />;
  else if (view === "profile" && bag.user) content = <ProfileView bag={bag} />;
  else content = <BrowseView bag={bag} />;

  return (
    <div className="d-app" style={{ minHeight: "100vh", background: BRAND.slate, color: BRAND.cream, fontFamily: "'Inter',sans-serif" }}>
      <style>{DESKTOP_CSS}</style>
      <div className="d-layer">
        <Header bag={bag} goHome={goHome} />
        <div key={viewKey} className="d-fade" style={{ maxWidth: 1240, margin: "0 auto", padding: "26px 24px 60px" }}>
          {content}
        </div>
      </div>

      <AuthModal open={bag.authOpen} user={bag.user} setAuthOpen={bag.setAuthOpen}
        otpSent={bag.otpSent} setOtpSent={bag.setOtpSent} otpCode={bag.otpCode} setOtpCode={bag.setOtpCode}
        authEmail={bag.authEmail} setAuthEmail={bag.setAuthEmail} authError={bag.authError} setAuthError={bag.setAuthError}
        handleAuth={bag.handleAuth} handleVerifyOtp={bag.handleVerifyOtp} />
      <LocationPicker open={bag.locPickerOpen} setLocPickerOpen={bag.setLocPickerOpen}
        locInput={bag.locInput} setLocInput={bag.setLocInput} saveLocPicker={bag.saveLocPicker}
        detectLocPicker={bag.detectLocPicker} locDetecting={bag.locDetecting} />

      {toast && (
        <div className="oswald" style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: BRAND.cream, color: BRAND.charcoal, borderRadius: 8, padding: "9px 18px", fontSize: 12, fontWeight: 700, letterSpacing: 0.5, zIndex: 100, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", borderLeft: `4px solid ${BRAND.green}` }}>{toast}</div>
      )}
    </div>
  );
}
