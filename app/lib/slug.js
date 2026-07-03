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
