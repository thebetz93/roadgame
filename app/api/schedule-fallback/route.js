import { VENUES } from "../../venues";

const SPORT = {
  nfl: { host: "v1.american-football.api-sports.io", leagueId: 1 },
  nba: { host: "v1.basketball.api-sports.io",        leagueId: 12 },
  mlb: { host: "v1.baseball.api-sports.io",          leagueId: 1 },
  nhl: { host: "v1.hockey.api-sports.io",            leagueId: 57 },
};

function seasonStr(league) {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  if (league === "nfl") return m <= 1 ? y - 1 : y;
  if (league === "nba" || league === "nhl") return m >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  return y; // mlb
}

function apiHeaders(key) {
  return { "x-apisports-key": key };
}

function resolveVenueKey(name) {
  if (!name) return null;
  if (VENUES[name]) return name;
  const nick = name.split(" ").pop().toLowerCase();
  return Object.keys(VENUES).find(k => k.split(" ").pop().toLowerCase() === nick) || null;
}

function parseGame(g, ourTeam, league) {
  const dateISO = g.date || g.game?.date?.date;
  if (!dateISO) return null;

  // Normalize across NFL / NBA / MLB / NHL response shapes
  const teams = g.teams || g.game?.teams;
  if (!teams?.home || !teams?.away) return null;

  const homeApi  = teams.home.name;
  const awayApi  = teams.away.name;
  const homeKey  = resolveVenueKey(homeApi);
  const venueData = homeKey ? VENUES[homeKey] : null;

  const nick   = ourTeam.split(" ").pop().toLowerCase();
  const isHome = (homeApi || "").toLowerCase().includes(nick);

  const venueRaw = g.venue || g.game?.venue;
  const city = venueRaw?.city
    ? venueRaw.city
    : venueData?.c || "TBD";

  return {
    id: `apisports-${g.id || g.game?.id}`,
    home: homeKey || homeApi,
    away: resolveVenueKey(awayApi) || awayApi,
    isHome,
    dateISO,
    venue: venueRaw?.name || venueData?.v || "TBD",
    city,
    lat: venueData?.lat ?? null,
    lng: venueData?.lng ?? null,
    ticketsFrom: null,
    realData: true,
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const team   = searchParams.get("team");
  const league = searchParams.get("league");

  const cfg = SPORT[league];
  const key = process.env.NEXT_PUBLIC_APISPORTS_KEY;
  if (!cfg || !team || !key) {
    return Response.json([], { status: 200 });
  }

  const base    = `https://${cfg.host}`;
  const season  = seasonStr(league);
  const headers = apiHeaders(key);

  try {
    // Step 1: find team ID
    const searchRes = await fetch(
      `${base}/teams?search=${encodeURIComponent(team)}&league=${cfg.leagueId}&season=${season}`,
      { headers }
    );
    if (!searchRes.ok) return Response.json([], { status: 200 });
    const searchJson = await searchRes.json();
    const teamId = searchJson.response?.[0]?.id;
    if (!teamId) return Response.json([], { status: 200 });

    // Step 2: fetch games for that team
    const gamesRes = await fetch(
      `${base}/games?team=${teamId}&season=${season}&league=${cfg.leagueId}`,
      { headers }
    );
    if (!gamesRes.ok) return Response.json([], { status: 200 });
    const gamesJson = await gamesRes.json();

    const now = new Date();
    const games = (gamesJson.response || [])
      .map(g => parseGame(g, team, league))
      .filter(g => g !== null && new Date(g.dateISO) > now)
      .sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));

    return Response.json(games, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return Response.json([], { status: 200 });
  }
}
