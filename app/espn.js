// app/espn.js — ESPN unofficial API for real team schedules (no API key required)
// The site.api.espn.com endpoints are publicly accessible and support CORS.

import { VENUES } from './venues';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const SPORT = {
  nfl: 'football/nfl',
  nba: 'basketball/nba',
  mlb: 'baseball/mlb',
  nhl: 'hockey/nhl',
};

// ESPN uses the ending year for seasons that span two calendar years
// e.g. 2025-26 NBA season = season=2026
// In June 2026, always querying 2026 is correct for all sports
function espnSeason() { return new Date().getFullYear(); }

const API_ALIAS = {
  'Los Angeles Clippers': 'LA Clippers',
  'Oakland Athletics':    'Athletics',
  'Sacramento Athletics': 'Athletics',
  'Las Vegas Athletics':  'Athletics',
};

function resolveVenueKey(displayName) {
  if (!displayName) return null;
  if (VENUES[displayName]) return displayName;
  const alias = API_ALIAS[displayName];
  if (alias && VENUES[alias]) return alias;
  const nick = displayName.split(' ').pop().toLowerCase();
  return Object.keys(VENUES).find(k => k.split(' ').pop().toLowerCase() === nick) || null;
}

// Session cache so we only look up each team's ESPN ID once
const teamIdCache = {};

async function getTeamId(teamName, league) {
  const cacheKey = `${league}:${teamName}`;
  if (teamIdCache[cacheKey] != null) return teamIdCache[cacheKey];

  const path = SPORT[league];
  if (!path) return null;

  const url = `${BASE}/${path}/teams?limit=100`;
  console.log(`[ESPN] team lookup: ${url}`);
  const res = await fetch(url);
  if (!res.ok) { console.warn(`[ESPN] team list ${res.status}`); return null; }

  const json = await res.json();
  const teams = json.sports?.[0]?.leagues?.[0]?.teams?.map(t => t.team) || [];
  const nameLower = teamName.toLowerCase();
  const nick = teamName.split(' ').pop().toLowerCase();

  const match =
    teams.find(t => t.displayName?.toLowerCase() === nameLower) ||
    teams.find(t => t.nickname?.toLowerCase() === nick) ||
    teams.find(t => t.displayName?.toLowerCase().includes(nick));

  if (match?.id) {
    teamIdCache[cacheKey] = match.id;
    console.log(`[ESPN] matched "${teamName}" → ${match.displayName} (id=${match.id})`);
  } else {
    console.warn(`[ESPN] no match for "${teamName}" in ${league}`, teams.map(t => t.displayName));
  }
  return match?.id ?? null;
}

function parseEvent(event, ourTeam) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const dateISO = comp.date || event.date;
  if (!dateISO) return null;

  const homeComp = comp.competitors?.find(c => c.homeAway === 'home');
  const awayComp = comp.competitors?.find(c => c.homeAway === 'away');
  if (!homeComp || !awayComp) return null;

  const homeApi = homeComp.team?.displayName;
  const awayApi = awayComp.team?.displayName;

  const homeKey = resolveVenueKey(homeApi);
  if (!homeKey) return null;
  const venueData = VENUES[homeKey];

  const nick = ourTeam.split(' ').pop().toLowerCase();
  const isHome = (homeApi || '').toLowerCase().includes(nick);
  const awayKey = resolveVenueKey(awayApi) || awayApi;

  const v = comp.venue;
  const city = v?.address?.city && v?.address?.state
    ? `${v.address.city}, ${v.address.state}`
    : v?.address?.city || venueData.c || 'TBD';

  return {
    id: `espn-${event.id}`,
    home: homeKey,
    away: awayKey,
    isHome,
    dateISO,
    venue: v?.fullName || venueData.v || 'TBD',
    city,
    lat: venueData.lat,
    lng: venueData.lng,
    ticketsFrom: null,
    realData: true,
  };
}

export async function fetchTeamSchedule(teamName, league) {
  const path = SPORT[league];
  if (!path) return null;

  try {
    const season = espnSeason();
    console.log(`[ESPN] ${teamName} (${league}) season=${season}`);

    const teamId = await getTeamId(teamName, league);
    if (teamId == null) return null;

    const url = `${BASE}/${path}/teams/${teamId}/schedule?season=${season}`;
    console.log(`[ESPN] schedule: ${url}`);
    const res = await fetch(url);
    if (!res.ok) { console.warn(`[ESPN] schedule ${res.status}`); return null; }

    const json = await res.json();
    const events = json.events || [];
    console.log(`[ESPN] ${events.length} total events for ${teamName}`);

    const now = new Date();
    const upcoming = events
      .map(e => parseEvent(e, teamName))
      .filter(g => g !== null && new Date(g.dateISO) > now)
      .sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));

    console.log(`[ESPN] ${upcoming.length} upcoming games`);
    return upcoming;
  } catch (err) {
    console.warn('[ESPN] fetch error:', err);
    return null;
  }
}
