import { VENUES } from "../../venues";

// ── API-Sports config (NFL / NBA / MLB / NHL only) ──────────────────────────
const APISPORTS = {
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
  return y;
}

function resolveVenueKey(name) {
  if (!name) return null;
  if (VENUES[name]) return name;
  const nick = name.split(" ").pop().toLowerCase();
  return Object.keys(VENUES).find(k => k.split(" ").pop().toLowerCase() === nick) || null;
}

function parseApiSportsGame(g, ourTeam) {
  const dateISO = g.date || g.game?.date?.date;
  if (!dateISO) return null;
  const teams = g.teams || g.game?.teams;
  if (!teams?.home || !teams?.away) return null;

  const homeApi   = teams.home.name;
  const awayApi   = teams.away.name;
  const homeKey   = resolveVenueKey(homeApi);
  const venueData = homeKey ? VENUES[homeKey] : null;
  const nick      = ourTeam.split(" ").pop().toLowerCase();
  const isHome    = (homeApi || "").toLowerCase().includes(nick);
  const venueRaw  = g.venue || g.game?.venue;
  const city      = venueRaw?.city || venueData?.c || "TBD";

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

// ── Ticketmaster Discovery (all leagues, best for CFB) ───────────────────────
const NON_GAME = [
  "parking", "tailgate", "vip", "hospitality", "club pass",
  "experience", "fan fest", "watch party", "open practice",
  "training camp", "presale", "merchandise",
];

function parseTMEvent(ev, ourTeam) {
  const dateISO = ev.dates?.start?.dateTime || ev.dates?.start?.localDate;
  if (!dateISO) return null;

  const evName = ev.name || "";
  if (NON_GAME.some(k => evName.toLowerCase().includes(k))) return null;

  // Must mention at least part of the team name (last word = nickname e.g. "Bulldogs")
  const nick = ourTeam.split(" ").pop().toLowerCase();
  if (!evName.toLowerCase().includes(nick)) return null;

  const tmVenue = ev._embedded?.venues?.[0];
  const lat = tmVenue?.location?.latitude  ? parseFloat(tmVenue.location.latitude)  : null;
  const lng = tmVenue?.location?.longitude ? parseFloat(tmVenue.location.longitude) : null;
  const city = tmVenue?.city?.name && tmVenue?.state?.stateCode
    ? `${tmVenue.city.name}, ${tmVenue.state.stateCode}`
    : tmVenue?.city?.name || "TBD";
  const venueName = tmVenue?.name || "TBD";

  // Determine home/away by comparing venue lat/lng to team's home venue
  const teamVenue = VENUES[ourTeam];
  const isHome = teamVenue && lat && lng
    ? Math.abs(teamVenue.lat - lat) < 0.05 && Math.abs(teamVenue.lng - lng) < 0.05
    : false;

  // Parse opponent from event name: "Team A vs Team B" or "Team A vs. Team B"
  const vsParts = evName.split(/\s+vs\.?\s+/i);
  const opponent = vsParts.length > 1
    ? (vsParts[0].toLowerCase().includes(ourTeam.split(" ").pop().toLowerCase())
       ? vsParts[1].trim()
       : vsParts[0].trim())
    : "TBD";

  return {
    id: `tm-${ev.id}`,
    home: isHome ? ourTeam : opponent,
    away: isHome ? opponent : ourTeam,
    isHome,
    dateISO,
    venue: venueName,
    city,
    lat,
    lng,
    ticketsFrom: ev.priceRanges?.length
      ? Math.floor(Math.min(...ev.priceRanges.map(r => r.min).filter(Boolean)))
      : null,
    realData: true,
  };
}

const TM_CLASSIFICATION = {
  nfl: "NFL",
  nba: "NBA",
  mlb: "MLB",
  nhl: "NHL",
  cfb: "College Football",
};

async function fetchFromTicketmaster(team, league) {
  const key = process.env.NEXT_PUBLIC_TICKETMASTER_KEY;
  if (!key) return [];

  const classification = TM_CLASSIFICATION[league] || "Football";
  const now = new Date().toISOString().split(".")[0] + "Z";
  const url = `https://app.ticketmaster.com/discovery/v2/events.json` +
    `?apikey=${key}` +
    `&keyword=${encodeURIComponent(team)}` +
    `&classificationName=${encodeURIComponent(classification)}` +
    `&startDateTime=${now}` +
    `&size=30&sort=date,asc&countryCode=US`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const events = data?._embedded?.events ?? [];
    const nowDate = new Date();
    return events
      .map(ev => parseTMEvent(ev, team))
      .filter(g => g !== null && new Date(g.dateISO) > nowDate)
      .sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));
  } catch {
    return [];
  }
}

async function fetchFromApiSports(team, league) {
  const cfg = APISPORTS[league];
  const key = process.env.NEXT_PUBLIC_APISPORTS_KEY;
  if (!cfg || !key) return [];

  const base    = `https://${cfg.host}`;
  const season  = seasonStr(league);
  const headers = { "x-apisports-key": key };

  try {
    const searchRes = await fetch(
      `${base}/teams?search=${encodeURIComponent(team)}&league=${cfg.leagueId}&season=${season}`,
      { headers }
    );
    if (!searchRes.ok) return [];
    const searchJson = await searchRes.json();
    const teamId = searchJson.response?.[0]?.id;
    if (!teamId) return [];

    const gamesRes = await fetch(
      `${base}/games?team=${teamId}&season=${season}&league=${cfg.leagueId}`,
      { headers }
    );
    if (!gamesRes.ok) return [];
    const gamesJson = await gamesRes.json();

    const now = new Date();
    return (gamesJson.response || [])
      .map(g => parseApiSportsGame(g, team))
      .filter(g => g !== null && new Date(g.dateISO) > now)
      .sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));
  } catch {
    return [];
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const team   = searchParams.get("team");
  const league = searchParams.get("league");
  if (!team || !league) return Response.json([], { status: 200 });

  // CFB: skip API-Sports (no college coverage), go straight to Ticketmaster
  // Others: try API-Sports first, fall back to Ticketmaster
  let games = [];

  if (league !== "cfb") {
    games = await fetchFromApiSports(team, league);
  }

  if (games.length === 0) {
    games = await fetchFromTicketmaster(team, league);
  }

  return Response.json(games, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
