// URL slug helpers for SEO route pages. Team names are unique across leagues in
// our data, so a slug resolves to a single { team, league }.
import { TEAMS_BY_LEAGUE } from "./leagues";

export function slugifyTeam(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[.']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// City slug, e.g. "Kansas City, MO" -> "kansas-city-mo"
export function slugifyCity(city) {
  return city
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/&/g, "and")
    .replace(/[.']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const TEAM_BY_SLUG = (() => {
  const map = {};
  for (const [league, teams] of Object.entries(TEAMS_BY_LEAGUE)) {
    for (const team of teams) map[slugifyTeam(team)] = { team, league };
  }
  return map;
})();

export function resolveTeamSlug(slug) {
  return TEAM_BY_SLUG[slug] || null;
}

export function allTeams() {
  return Object.entries(TEAM_BY_SLUG).map(([slug, v]) => ({ slug, ...v }));
}

// Game slug = "<team-slug>-<espnId>", e.g. "atlanta-braves-401581". Encoding the
// team lets the game page reuse the proven schedule parser (fetchTeamSchedule)
// instead of a separate single-game endpoint. The espnId is the trailing digits.
export function gameSlug(teamSlugStr, gameId) {
  const espnId = String(gameId).replace(/^espn-/, "");
  return `${teamSlugStr}-${espnId}`;
}

export function parseGameSlug(slug) {
  const m = /^(.*)-(\d+)$/.exec(slug || "");
  if (!m) return null;
  const resolved = resolveTeamSlug(m[1]);
  if (!resolved) return null;
  return { ...resolved, teamSlug: m[1], espnId: m[2], gameId: `espn-${m[2]}` };
}
