import { VENUES } from './venues';

const KEY = process.env.NEXT_PUBLIC_APISPORTS_KEY;

// Session-scoped cache: avoids repeat team-ID lookups on the same page
const idCache = {};

// Calculate current season dynamically so this never goes stale
function currentSeason(leagueStartMonth) {
  const now = new Date();
  const m = now.getMonth(); // 0 = Jan
  return m >= leagueStartMonth ? now.getFullYear() : now.getFullYear() - 1;
}

const CFG = {
  // NFL: Jan-Feb = previous year (still in playoffs); Mar-Aug = current year (upcoming season, schedule released May); Sep-Dec = current year
  nfl: { base: 'https://v1.american-football.api-sports.io', league: 1, teamSearch: 'search',
    get season() { const m = new Date().getMonth(); return m <= 1 ? new Date().getFullYear() - 1 : new Date().getFullYear(); } },
  // NBA starts October (month 9)
  nba: { base: 'https://v2.nba.api-sports.io', league: null, teamSearch: 'search',
    get season() { return currentSeason(9); } },
  // MLB is calendar year — baseball API uses 'name' not 'search' for team lookup
  mlb: { base: 'https://v1.baseball.api-sports.io', league: 1, teamSearch: 'name',
    get season() { return new Date().getFullYear(); } },
  // NHL starts October (month 9)
  nhl: { base: 'https://v1.hockey.api-sports.io', league: 57, teamSearch: 'search',
    get season() { return currentSeason(9); } },
};

// API-Sports occasionally uses different names than our VENUES keys
const API_ALIAS = {
  'Los Angeles Clippers': 'LA Clippers',
  'Oakland Athletics':    'Athletics',
  'Sacramento Athletics': 'Athletics',
  'Las Vegas Athletics':  'Athletics',
};

function resolveVenueKey(apiName) {
  if (!apiName) return null;
  if (VENUES[apiName]) return apiName;
  const alias = API_ALIAS[apiName];
  if (alias && VENUES[alias]) return alias;
  // Nickname fallback: "Lakers" → first VENUES key whose last word matches
  const nick = apiName.split(' ').pop().toLowerCase();
  return Object.keys(VENUES).find(k => k.split(' ').pop().toLowerCase() === nick) || null;
}

function hdrs() { return { 'x-apisports-key': KEY }; }

async function getTeamId(teamName, league) {
  const ck = `${league}:${teamName}`;
  if (idCache[ck] != null) return idCache[ck];

  const cfg = CFG[league];
  if (!cfg) return null;

  const nickname = teamName.split(' ').pop();
  const searchParam = cfg.teamSearch || 'search';
  let url = `${cfg.base}/teams?${searchParam}=${encodeURIComponent(nickname)}`;
  if (cfg.league) url += `&league=${cfg.league}&season=${cfg.season}`;

  console.log(`[API-Sports] team search: ${url}`);
  const res = await fetch(url, { headers: hdrs() });
  console.log(`[API-Sports] team search status: ${res.status}`);
  if (!res.ok) {
    console.warn(`[API-Sports] HTTP error ${res.status} looking up ${teamName}`);
    return null;
  }
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    console.warn(`[API-Sports] ${league} API errors:`, json.errors);
    return null;
  }
  const { response: teams = [] } = json;
  console.log(`[API-Sports] found ${teams.length} team(s) for "${nickname}":`, teams.map(t => t.name));

  const wantLower = teamName.toLowerCase();
  // Also try the API alias (e.g. "Los Angeles Clippers" when we store "LA Clippers")
  const aliasLower = (Object.entries(API_ALIAS).find(([, v]) => v === teamName)?.[0] || '').toLowerCase();

  let match =
    teams.find(t => (t.name || '').toLowerCase() === wantLower) ||
    teams.find(t => (t.name || '').toLowerCase() === aliasLower) ||
    teams.find(t => (t.name || '').toLowerCase().includes(nickname.toLowerCase())) ||
    (teams.length === 1 ? teams[0] : null);

  console.log(`[API-Sports] matched team: ${match?.name} (id=${match?.id})`);
  if (match?.id != null) idCache[ck] = match.id;
  return match?.id ?? null;
}

async function getGames(teamId, league) {
  const cfg = CFG[league];
  let url = `${cfg.base}/games?team=${teamId}&season=${cfg.season}`;
  if (cfg.league) url += `&league=${cfg.league}`;

  console.log(`[API-Sports] games fetch: ${url}`);
  const res = await fetch(url, { headers: hdrs() });
  if (!res.ok) {
    console.warn(`[API-Sports] games HTTP error: ${res.status}`);
    return [];
  }
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    console.warn(`[API-Sports] games API errors:`, json.errors);
    return [];
  }
  const { response = [] } = json;
  console.log(`[API-Sports] got ${response.length} games`);
  return response;
}

function isOurTeam(apiName, ourTeam) {
  const a = (apiName || '').toLowerCase();
  const o = ourTeam.toLowerCase();
  const nick = ourTeam.split(' ').pop().toLowerCase();
  const aliasLow = (Object.entries(API_ALIAS).find(([, v]) => v === ourTeam)?.[0] || '').toLowerCase();
  return a === o || a === aliasLow || a.includes(nick);
}

function buildGame(id, homeApi, awayApi, ourTeam, dateISO, venueNameApi, venueCityApi) {
  if (!homeApi || !awayApi || !dateISO) return null;

  const homeKey = resolveVenueKey(homeApi);
  if (!homeKey) return null;
  const venue = VENUES[homeKey];

  const isHome = isOurTeam(homeApi, ourTeam);
  const awayKey = resolveVenueKey(awayApi) || awayApi;

  return {
    id,
    home: homeKey,
    away: awayKey,
    isHome,
    dateISO,
    venue: venueNameApi || venue.v || 'TBD',
    city: venueCityApi || venue.c || 'TBD',
    lat: venue.lat,
    lng: venue.lng,
    ticketsFrom: null,
    realData: true,
  };
}

// ── Per-sport parsers ──────────────────────────────────────────────────────────

function parseNFL(games, ourTeam) {
  return games.flatMap(g => {
    const d = g.game?.date;
    if (!d?.date) return [];
    const dateISO = d.time ? `${d.date}T${d.time}:00` : `${d.date}T13:00:00`;
    const game = buildGame(
      `nfl-${g.game?.id}`,
      g.teams?.home?.name, g.teams?.away?.name, ourTeam,
      dateISO,
      g.game?.venue?.name, g.game?.venue?.city,
    );
    return game ? [game] : [];
  });
}

function parseNBA(games, ourTeam) {
  return games.flatMap(g => {
    const dateISO = g.date?.start;
    if (!dateISO) return [];
    const city = g.arena?.state
      ? `${g.arena.city}, ${g.arena.state}`
      : g.arena?.city;
    const game = buildGame(
      `nba-${g.id}`,
      g.teams?.home?.name, g.teams?.visitors?.name, ourTeam,
      dateISO,
      g.arena?.name, city,
    );
    return game ? [game] : [];
  });
}

function parseMLB(games, ourTeam) {
  return games.flatMap(g => {
    if (!g.date) return [];
    const game = buildGame(
      `mlb-${g.id}`,
      g.teams?.home?.name, g.teams?.away?.name, ourTeam,
      g.date,
      g.venue?.name, g.venue?.city,
    );
    return game ? [game] : [];
  });
}

function parseNHL(games, ourTeam) {
  return games.flatMap(g => {
    if (!g.date) return [];
    const game = buildGame(
      `nhl-${g.id}`,
      g.teams?.home?.name, g.teams?.away?.name, ourTeam,
      g.date,
      g.arena?.name, g.arena?.city,
    );
    return game ? [game] : [];
  });
}

const PARSERS = { nfl: parseNFL, nba: parseNBA, mlb: parseMLB, nhl: parseNHL };

// ── Main export ────────────────────────────────────────────────────────────────

export async function fetchTeamSchedule(teamName, league) {
  if (!KEY) {
    console.warn('NEXT_PUBLIC_APISPORTS_KEY not configured — add it to .env.local');
    return null;
  }
  try {
    const cfg = CFG[league];
    console.log(`[API-Sports] ${teamName} (${league}) season=${cfg?.season}`);
    const teamId = await getTeamId(teamName, league);
    if (teamId == null) {
      console.warn(`[API-Sports] could not find team ID for ${teamName} — check API subscription at api-sports.io`);
      return null;
    }

    const raw = await getGames(teamId, league);
    if (!raw.length) return [];

    const parser = PARSERS[league];
    if (!parser) return null;

    const now = new Date();
    const upcoming = parser(raw, teamName)
      .filter(g => new Date(g.dateISO) > now)
      .sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));
    console.log(`[API-Sports] ${upcoming.length} upcoming games for ${teamName}`);
    return upcoming;
  } catch (err) {
    console.warn('API-Sports fetch error:', err);
    return null;
  }
}
