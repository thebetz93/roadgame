import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveCitySlug, resolveTeamSlug, slugifyCity, slugifyTeam, gameSlug } from "../../../lib/slug";
import { fetchTeamSchedule, teamLogoUrl } from "../../../espn";
import { LEAGUES } from "../../../lib/leagues";
import { BRAND } from "../../../lib/brand";

export const revalidate = 3600;
const SITE = "https://myroadgame.com";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York",
  });
}

async function load(citySlug, teamSlug) {
  const city = resolveCitySlug(citySlug);
  const team = resolveTeamSlug(teamSlug);
  if (!city || !team) return null;
  const all = (await fetchTeamSchedule(team.team, team.league)) || [];
  const games = all.filter(g => g.city && slugifyCity(g.city) === citySlug);
  return { city, team, games };
}

export async function generateMetadata({ params }) {
  const { city: citySlug, team: teamSlug } = await params;
  const data = await load(citySlug, teamSlug);
  if (!data) return { title: "Not found | RoadGame" };
  const { city, team } = data;
  const leagueName = LEAGUES.find(l => l.id === team.league)?.name || team.league.toUpperCase();
  const title = `${team.team} in ${city.city} — Game Schedule & Tickets | RoadGame`;
  const description = `When do the ${team.team} (${leagueName}) play in ${city.city}? Upcoming dates, venue, and ticket links. Plan the trip with RoadGame.`;
  const url = `${SITE}/cities/${citySlug}/${teamSlug}`;
  const image = `${SITE}/logo.png`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "RoadGame", type: "website", images: [{ url: image }] },
    twitter: { card: "summary", title, description, images: [image] },
  };
}

export default async function CityTeamPage({ params }) {
  const { city: citySlug, team: teamSlug } = await params;
  const data = await load(citySlug, teamSlug);
  if (!data) notFound();
  const { city, team, games } = data;
  const leagueMeta = LEAGUES.find(l => l.id === team.league);
  const logo = teamLogoUrl(team.team, team.league);

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
        <Link href={`/cities/${citySlug}`} className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>← {city.city.toUpperCase()}</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, marginBottom: 18 }}>
          {logo && <span style={{ width: 48, height: 48, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><img src={logo} alt="" width={38} height={38} style={{ objectFit: "contain" }} /></span>}
          <div>
            <div className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>{leagueMeta?.emoji} {leagueMeta?.name}</div>
            <h1 className="oswald" style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.05 }}>{team.team} in {city.city}</h1>
          </div>
        </div>

        {games.length === 0 ? (
          <div style={{ background: BRAND.slateLight, border: `2px dashed ${BRAND.green}`, borderRadius: 12, padding: "32px 20px", textAlign: "center" }}>
            <div className="oswald" style={{ fontSize: 17, fontWeight: 700 }}>NO UPCOMING GAMES</div>
            <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 6 }}>The {team.team} don't have upcoming games in {city.city} posted yet.</div>
          </div>
        ) : (
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {games.map(g => (
              <li key={g.id}>
                <Link href={`/games/${gameSlug(teamSlug, g.id)}`} style={{ display: "block", background: BRAND.slateLight, borderLeft: `4px solid ${g.isHome ? BRAND.green : BRAND.amber}`, borderRadius: 10, padding: "12px 14px" }}>
                  <div className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>{fmtDate(g.dateISO)} · {g.isHome ? "HOME" : "AWAY"}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: BRAND.cream }}>{g.isHome ? `${team.team} vs ${g.away}` : `${team.team} @ ${g.home}`}</div>
                  <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 1 }}>{g.venue} · {g.city}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
