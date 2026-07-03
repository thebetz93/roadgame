import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveTeamSlug, slugifyTeam } from "../../lib/slug";
import { fetchTeamSchedule, teamLogoUrl } from "../../espn";
import { VENUES } from "../../venues";
import { LEAGUES } from "../../lib/leagues";
import { BRAND } from "../../lib/brand";

// Server-rendered, crawlable team page. Refreshes hourly (ISR). Not prerendered
// at build (no generateStaticParams) so it renders on-demand where ESPN is
// reachable. Distances are personalized, so they live in the app, not here.
export const revalidate = 3600;

const SITE = "https://myroadgame.com";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York",
  });
}

export async function generateMetadata({ params }) {
  const { team: slug } = await params;
  const resolved = resolveTeamSlug(slug);
  if (!resolved) return { title: "Team not found | RoadGame" };
  const { team, league } = resolved;
  const venue = VENUES[team];
  const leagueName = LEAGUES.find(l => l.id === league)?.name || league.toUpperCase();
  const title = `${team} Schedule & Tickets — Games Near You | RoadGame`;
  const description = `${team} (${leagueName}) upcoming schedule with ticket links. Find ${team} games within driving or flying distance of your city and compare seat prices.${venue ? ` Home venue: ${venue.v}, ${venue.c}.` : ""}`;
  const url = `${SITE}/teams/${slug}`;
  const image = `${SITE}/logo.png`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "RoadGame", type: "website", images: [{ url: image }] },
    twitter: { card: "summary", title, description, images: [image] },
  };
}

export default async function TeamPage({ params }) {
  const { team: slug } = await params;
  const resolved = resolveTeamSlug(slug);
  if (!resolved) notFound();
  const { team, league } = resolved;

  const venue = VENUES[team];
  const leagueMeta = LEAGUES.find(l => l.id === league);
  const logo = teamLogoUrl(team, league);
  const games = (await fetchTeamSchedule(team, league)) || [];

  return (
    <div style={{ minHeight: "100vh", background: BRAND.slate, color: BRAND.cream, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ background: BRAND.slateDark, borderBottom: `2px solid ${BRAND.green}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 14, padding: "13px 20px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center" }}>
            <img src="/logo.png" alt="RoadGame" style={{ height: 30, width: "auto" }} />
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/" className="oswald" style={{ background: BRAND.green, color: BRAND.charcoal, borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>OPEN THE APP →</Link>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "26px 20px 60px" }}>
        {/* Team hero */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          {logo
            ? <div style={{ width: 60, height: 60, borderRadius: 14, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <img src={logo} alt={`${team} logo`} width={48} height={48} style={{ objectFit: "contain" }} />
              </div>
            : <div className="oswald" style={{ width: 60, height: 60, borderRadius: 14, background: BRAND.slateLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>{team.split(" ").map(w => w[0]).slice(0, 2).join("")}</div>}
          <div>
            <div className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>{leagueMeta?.emoji} {leagueMeta?.name} · {leagueMeta?.season}</div>
            <h1 className="oswald" style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.05 }}>{team}</h1>
            {venue && <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 3 }}>🏟️ {venue.v} · {venue.c}</div>}
          </div>
        </div>

        <p style={{ fontSize: 14, color: BRAND.muted, lineHeight: 1.5, marginBottom: 22, maxWidth: 640 }}>
          Upcoming {team} games with ticket links. <Link href="/" style={{ color: BRAND.green, fontWeight: 600 }}>Open RoadGame</Link> to see how far each game is from your city, get proximity alerts, and compare ticket prices.
        </p>

        {/* Schedule (server-rendered) */}
        <h2 className="oswald" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3, marginBottom: 12 }}>UPCOMING SCHEDULE</h2>
        {games.length === 0 ? (
          <div style={{ background: BRAND.slateLight, border: `2px dashed ${BRAND.green}`, borderRadius: 12, padding: "32px 20px", textAlign: "center" }}>
            <div className="oswald" style={{ fontSize: 17, fontWeight: 700 }}>COME BACK NEXT SEASON</div>
            <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 6 }}>No upcoming {team} games are posted yet.</div>
          </div>
        ) : (
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {games.map(g => (
              <li key={g.id} style={{
                background: BRAND.slateLight, borderLeft: `4px solid ${g.isHome ? BRAND.green : BRAND.amber}`,
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>
                  {fmtDate(g.dateISO)} · {g.isHome ? "HOME" : "AWAY"}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{g.isHome ? `${team} vs ${g.away}` : `${team} @ ${g.home}`}</div>
                <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 1 }}>{g.venue}{g.city ? ` · ${g.city}` : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
