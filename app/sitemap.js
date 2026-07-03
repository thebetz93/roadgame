import { allTeams, allCities, slugifyTeam } from "./lib/slug";
import { fetchTeamSchedule } from "./espn";

// Regenerated at most hourly. Static hub URLs (teams, schedules, cities,
// city-team combos) are always emitted; game URLs are best-effort so a slow or
// failed ESPN fetch can't break the whole sitemap.
export const revalidate = 3600;

const SITE = "https://myroadgame.com";
const PRO = new Set(["nfl", "nba", "mlb", "nhl"]);

export default async function sitemap() {
  const now = new Date();
  const teams = allTeams();
  const cities = allCities();

  const urls = [{ url: `${SITE}/`, changeFrequency: "daily", priority: 1 }];

  for (const t of teams) {
    urls.push({ url: `${SITE}/teams/${t.slug}`, changeFrequency: "daily", priority: 0.8 });
    urls.push({ url: `${SITE}/teams/${t.slug}/schedule`, changeFrequency: "daily", priority: 0.7 });
  }
  for (const c of cities) {
    urls.push({ url: `${SITE}/cities/${c.slug}`, changeFrequency: "weekly", priority: 0.6 });
    for (const team of c.teams) {
      urls.push({ url: `${SITE}/cities/${c.slug}/${slugifyTeam(team)}`, changeFrequency: "weekly", priority: 0.5 });
    }
  }

  // Best-effort upcoming game URLs (pro leagues have reliable ESPN data).
  // Deduped by ESPN event id, using the home team's slug as the canonical URL.
  try {
    const proTeams = teams.filter(t => PRO.has(t.league));
    const results = await Promise.allSettled(proTeams.map(t => fetchTeamSchedule(t.team, t.league)));
    const seen = new Set();
    results.forEach((res, i) => {
      if (res.status !== "fulfilled" || !Array.isArray(res.value)) return;
      const t = proTeams[i];
      for (const g of res.value) {
        const espnId = String(g.id).replace(/^espn-/, "");
        if (seen.has(espnId)) continue;
        seen.add(espnId);
        const homeName = g.isHome ? t.team : g.home;
        urls.push({ url: `${SITE}/games/${slugifyTeam(homeName)}-${espnId}`, changeFrequency: "daily", priority: 0.6 });
      }
    });
  } catch {
    // leave games out this cycle rather than failing the sitemap
  }

  return urls.map(u => ({ lastModified: now, ...u }));
}
