import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveCitySlug, resolveTeamSlug, slugifyTeam, gameSlug } from "../../lib/slug";
import { fetchTeamSchedule, teamLogoUrl } from "../../espn";
import { LEAGUES } from "../../lib/leagues";
import { BRAND } from "../../lib/brand";

export const revalidate = 3600;
const SITE = "https://myroadgame.com";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York",
  });
}

function leagueOf(team) {
  const r = resolveTeamSlug(slugifyTeam(team));
  return r?.league || null;
}

export async function generateMetadata({ params }) {
  const { city: slug } = await params;
  const resolved = resolveCitySlug(slug);
  if (!resolved) return { title: "City not found | RoadGame" };
  const { city, teams } = resolved;
  const title = `${city} Sports — Games, Teams & Tickets | RoadGame`;
  const description = `Plan a sports trip to ${city}: home teams (${teams.slice(0, 4).join(", ")}${teams.length > 4 ? ", and more" : ""}), upcoming home games, venues, and ticket links. See what's playing near you on RoadGame.`;
  const url = `${SITE}/cities/${slug}`;
  const image = `${SITE}/logo.png`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "RoadGame", type: "website", images: [{ url: image }] },
    twitter: { card: "summary", title, description, images: [image] },
  };
}

export default async function CityPage({ params }) {
  const { city: slug } = await params;
  const resolved = resolveCitySlug(slug);
  if (!resolved) notFound();
  const { city, teams } = resolved;

  // Upcoming home games across the city's teams (home games happen in this city).
  const schedules = await Promise.all(teams.map(async team => {
    const league = leagueOf(team);
    const games = league ? (await fetchTeamSchedule(team, league)) || [] : [];
    return games.filter(g => g.isHome).map(g => ({ ...g, team, league }));
  }));
  const games = schedules.flat().sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO)).slice(0, 20);

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
        <div className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>📍 SPORTS IN</div>
        <h1 className="oswald" style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.05 }}>{city}</h1>
        <p style={{ fontSize: 14, color: BRAND.muted, lineHeight: 1.5, margin: "10px 0 22px", maxWidth: 640 }}>
          Teams, upcoming home games, and venues in {city}. <Link href="/" style={{ color: BRAND.green, fontWeight: 600 }}>Open RoadGame</Link> to see how far {city} is from you and plan the trip.
        </p>

        <h2 className="oswald" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3, marginBottom: 12 }}>TEAMS IN {city.toUpperCase()}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginBottom: 26 }}>
          {teams.map(team => {
            const league = leagueOf(team);
            const logo = league ? teamLogoUrl(team, league) : null;
            const meta = LEAGUES.find(l => l.id === league);
            return (
              <Link key={team} href={`/cities/${slug}/${slugifyTeam(team)}`} style={{ display: "flex", alignItems: "center", gap: 11, background: BRAND.slateLight, borderRadius: 10, padding: "11px 13px" }}>
                {logo
                  ? <span style={{ width: 34, height: 34, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><img src={logo} alt="" width={26} height={26} style={{ objectFit: "contain" }} /></span>
                  : <span className="oswald" style={{ width: 34, height: 34, borderRadius: 8, background: BRAND.slate, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{team.split(" ").map(w => w[0]).slice(0, 2).join("")}</span>}
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: BRAND.cream }}>{team}</span>
                  <span className="oswald" style={{ fontSize: 10, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>{meta?.emoji} {meta?.name}</span>
                </span>
              </Link>
            );
          })}
        </div>

        {games.length > 0 && (
          <>
            <h2 className="oswald" style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.3, marginBottom: 12 }}>UPCOMING GAMES IN {city.toUpperCase()}</h2>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {games.map(g => (
                <li key={g.id}>
                  <Link href={`/games/${gameSlug(slugifyTeam(g.team), g.id)}`} style={{ display: "block", background: BRAND.slateLight, borderLeft: `4px solid ${BRAND.green}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div className="oswald" style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>{fmtDate(g.dateISO)}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, color: BRAND.cream }}>{g.team} vs {g.away}</div>
                    <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 1 }}>{g.venue}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
