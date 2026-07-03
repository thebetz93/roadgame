import { notFound } from "next/navigation";
import Link from "next/link";
import { parseGameSlug, slugifyTeam } from "../../lib/slug";
import { fetchTeamSchedule } from "../../espn";
import { LEAGUES } from "../../lib/leagues";
import { BRAND } from "../../lib/brand";

export const revalidate = 3600;
const SITE = "https://myroadgame.com";

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York",
  });
}

// Load a single game by re-using the proven schedule parser.
async function loadGame(slug) {
  const parsed = parseGameSlug(slug);
  if (!parsed) return null;
  const games = (await fetchTeamSchedule(parsed.team, parsed.league)) || [];
  const game = games.find(g => g.id === parsed.gameId);
  return game ? { ...parsed, game } : null;
}

function seatGeekUrl(team) {
  const s = slugifyTeam(team);
  return `https://seatgeek.com/${s}-tickets`;
}

export async function generateMetadata({ params }) {
  const { gameId } = await params;
  const data = await loadGame(gameId);
  if (!data) return { title: "Game not found | RoadGame" };
  const { game, team, league } = data;
  const matchup = game.isHome ? `${team} vs ${game.away}` : `${team} at ${game.home}`;
  const leagueName = LEAGUES.find(l => l.id === league)?.name || league.toUpperCase();
  const dateStr = new Date(game.dateISO).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  const title = `${matchup} Tickets — ${dateStr} | RoadGame`;
  const description = `${matchup} (${leagueName}) on ${dateStr} at ${game.venue}, ${game.city}. Compare ticket prices and see how far the game is from your city on RoadGame.`;
  const url = `${SITE}/games/${gameId}`;
  const image = `${SITE}/logo.png`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "RoadGame", type: "website", images: [{ url: image }] },
    twitter: { card: "summary", title, description, images: [image] },
  };
}

export default async function GamePage({ params }) {
  const { gameId } = await params;
  const data = await loadGame(gameId);
  if (!data) notFound();
  const { game, team, teamSlug, league } = data;
  const leagueMeta = LEAGUES.find(l => l.id === league);
  const matchup = game.isHome ? `${team} vs ${game.away}` : `${team} @ ${game.home}`;
  const opponent = game.isHome ? game.away : game.home;
  const tickets = seatGeekUrl(team);

  // JSON-LD SportsEvent structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${game.isHome ? team : game.home} vs ${game.isHome ? game.away : team}`,
    startDate: game.dateISO,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: game.venue,
      address: game.city,
      ...(game.lat != null && game.lng != null
        ? { geo: { "@type": "GeoCoordinates", latitude: game.lat, longitude: game.lng } }
        : {}),
    },
    homeTeam: { "@type": "SportsTeam", name: game.isHome ? team : game.home },
    awayTeam: { "@type": "SportsTeam", name: game.isHome ? game.away : team },
    offers: {
      "@type": "Offer",
      url: tickets,
      availability: "https://schema.org/InStock",
      category: "primary",
    },
    organizer: { "@type": "Organization", name: leagueMeta?.name || league.toUpperCase() },
  };

  return (
    <div style={{ minHeight: "100vh", background: BRAND.slate, color: BRAND.cream, fontFamily: "'Inter', sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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
        <Link href={`/teams/${teamSlug}`} className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>← {team.toUpperCase()}</Link>
        <div className="oswald" style={{ fontSize: 11, color: BRAND.muted, fontWeight: 700, letterSpacing: 1.5, marginTop: 10 }}>{leagueMeta?.emoji} {leagueMeta?.name}</div>
        <h1 className="oswald" style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.05, marginTop: 2 }}>{matchup}</h1>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, marginBottom: 22 }}>
          <div style={{ background: BRAND.slateLight, borderRadius: 10, padding: "12px 16px" }}>
            <div className="oswald" style={{ fontSize: 10, color: BRAND.muted, letterSpacing: 1.2, fontWeight: 700 }}>WHEN</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{fmtDateTime(game.dateISO)} ET</div>
          </div>
          <div style={{ background: BRAND.slateLight, borderRadius: 10, padding: "12px 16px" }}>
            <div className="oswald" style={{ fontSize: 10, color: BRAND.muted, letterSpacing: 1.2, fontWeight: 700 }}>WHERE</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{game.venue} · {game.city}</div>
          </div>
        </div>

        <p style={{ fontSize: 14, color: BRAND.muted, lineHeight: 1.5, marginBottom: 20, maxWidth: 640 }}>
          {game.isHome ? `${team} host ${opponent}` : `${team} visit ${opponent}`} at {game.venue}. <Link href="/" style={{ color: BRAND.green, fontWeight: 600 }}>Open RoadGame</Link> to see how far this game is from your city, get a proximity alert, and compare seat prices.
        </p>

        <a href={tickets} target="_blank" rel="noopener noreferrer" className="oswald" style={{ display: "inline-block", background: BRAND.green, color: BRAND.charcoal, borderRadius: 10, padding: "13px 26px", fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>FIND TICKETS →</a>
      </main>
    </div>
  );
}
