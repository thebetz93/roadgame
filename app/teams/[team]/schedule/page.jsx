import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveTeamSlug, gameSlug } from "../../../lib/slug";
import { fetchTeamSchedule, teamLogoUrl } from "../../../espn";
import { VENUES } from "../../../venues";
import { LEAGUES } from "../../../lib/leagues";
import { BRAND } from "../../../lib/brand";

export const revalidate = 3600;
const SITE = "https://myroadgame.com";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York",
  });
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

export async function generateMetadata({ params }) {
  const { team: slug } = await params;
  const resolved = resolveTeamSlug(slug);
  if (!resolved) return { title: "Team not found | RoadGame" };
  const { team, league } = resolved;
  const leagueName = LEAGUES.find(l => l.id === league)?.name || league.toUpperCase();
  const title = `${team} Full Schedule — Dates, Venues & Tickets | RoadGame`;
  const description = `Complete ${team} (${leagueName}) upcoming schedule: every game date, home/away, venue, and ticket link. Find the games closest to you with RoadGame.`;
  const url = `${SITE}/teams/${slug}/schedule`;
  const image = `${SITE}/logo.png`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "RoadGame", type: "website", images: [{ url: image }] },
    twitter: { card: "summary", title, description, images: [image] },
  };
}

export default async function TeamSchedulePage({ params }) {
  const { team: slug } = await params;
  const resolved = resolveTeamSlug(slug);
  if (!resolved) notFound();
  const { team, league } = resolved;
  const leagueMeta = LEAGUES.find(l => l.id === league);
  const logo = teamLogoUrl(team, league);
  const games = (await fetchTeamSchedule(team, league)) || [];
  const homeCount = games.filter(g => g.isHome).length;

  return (
    <div style={{ minHeight: "100vh", background: BRAND.slate, color: BRAND.cream, fontFamily: "'Inter', sans-serif" }}>
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
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          {logo && <span style={{ width: 48, height: 48, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><img src={logo} alt="" width={38} height={38} style={{ objectFit: "contain" }} /></span>}
          <div>
            <Link href={`/teams/${slug}`} className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>← {team.toUpperCase()}</Link>
            <h1 className="oswald" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.05, marginTop: 2 }}>{team} Schedule</h1>
          </div>
        </div>
        <div style={{ fontSize: 13, color: BRAND.muted, marginBottom: 22 }}>
          {leagueMeta?.emoji} {leagueMeta?.name} · {games.length} upcoming game{games.length === 1 ? "" : "s"} · {homeCount} home
        </div>

        {games.length === 0 ? (
          <div style={{ background: BRAND.slateLight, border: `2px dashed ${BRAND.green}`, borderRadius: 12, padding: "32px 20px", textAlign: "center" }}>
            <div className="oswald" style={{ fontSize: 17, fontWeight: 700 }}>COME BACK NEXT SEASON</div>
            <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 6 }}>No upcoming {team} games are posted yet.</div>
          </div>
        ) : (
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {games.map(g => (
              <li key={g.id}>
                <Link href={`/games/${gameSlug(slug, g.id)}`} style={{ display: "block", background: BRAND.slateLight, borderLeft: `4px solid ${g.isHome ? BRAND.green : BRAND.amber}`, borderRadius: 10, padding: "12px 14px" }}>
                  <div className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>{fmtDate(g.dateISO)} · {fmtTime(g.dateISO)} ET · {g.isHome ? "HOME" : "AWAY"}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: BRAND.cream }}>{g.isHome ? `${team} vs ${g.away}` : `${team} @ ${g.home}`}</div>
                  <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 1 }}>{g.venue}{g.city ? ` · ${g.city}` : ""}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
