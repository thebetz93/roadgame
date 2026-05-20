// app/ticketmaster.js — Real Ticketmaster Discovery API wrapper
// Filters out non-game events and normalizes opponent names to full team names.

const API_KEY = process.env.NEXT_PUBLIC_TICKETMASTER_KEY;
const BASE_URL = "https://app.ticketmaster.com/discovery/v2";

const LEAGUE_TO_CLASSIFICATION = {
  nfl: "Football",
  nba: "Basketball",
  mlb: "Baseball",
  nhl: "Hockey",
};

const NON_GAME_KEYWORDS = [
  "club pass", "not a game", "parking", "tailgate", "fan club",
  "social", "experience", "tour", "vip", "premium", "hospitality",
  "member", "season pass", "watch party", "open practice",
  "fan fest", "draft party", "merchandise", "training camp",
];

// Full official team names by league — used to normalize loose Ticketmaster names
const OFFICIAL_TEAMS = {
  nfl: ["Arizona Cardinals","Atlanta Falcons","Baltimore Ravens","Buffalo Bills","Carolina Panthers","Chicago Bears","Cincinnati Bengals","Cleveland Browns","Dallas Cowboys","Denver Broncos","Detroit Lions","Green Bay Packers","Houston Texans","Indianapolis Colts","Jacksonville Jaguars","Kansas City Chiefs","Las Vegas Raiders","Los Angeles Chargers","Los Angeles Rams","Miami Dolphins","Minnesota Vikings","New England Patriots","New Orleans Saints","New York Giants","New York Jets","Philadelphia Eagles","Pittsburgh Steelers","San Francisco 49ers","Seattle Seahawks","Tampa Bay Buccaneers","Tennessee Titans","Washington Commanders"],
  nba: ["Atlanta Hawks","Boston Celtics","Brooklyn Nets","Charlotte Hornets","Chicago Bulls","Cleveland Cavaliers","Dallas Mavericks","Denver Nuggets","Detroit Pistons","Golden State Warriors","Houston Rockets","Indiana Pacers","LA Clippers","Los Angeles Lakers","Memphis Grizzlies","Miami Heat","Milwaukee Bucks","Minnesota Timberwolves","New Orleans Pelicans","New York Knicks","Oklahoma City Thunder","Orlando Magic","Philadelphia 76ers","Phoenix Suns","Portland Trail Blazers","Sacramento Kings","San Antonio Spurs","Toronto Raptors","Utah Jazz","Washington Wizards"],
  mlb: ["Arizona Diamondbacks","Atlanta Braves","Baltimore Orioles","Boston Red Sox","Chicago Cubs","Chicago White Sox","Cincinnati Reds","Cleveland Guardians","Colorado Rockies","Detroit Tigers","Houston Astros","Kansas City Royals","Los Angeles Angels","Los Angeles Dodgers","Miami Marlins","Milwaukee Brewers","Minnesota Twins","New York Mets","New York Yankees","Athletics","Philadelphia Phillies","Pittsburgh Pirates","San Diego Padres","San Francisco Giants","Seattle Mariners","St. Louis Cardinals","Tampa Bay Rays","Texas Rangers","Toronto Blue Jays","Washington Nationals"],
  nhl: ["Anaheim Ducks","Boston Bruins","Buffalo Sabres","Calgary Flames","Carolina Hurricanes","Chicago Blackhawks","Colorado Avalanche","Columbus Blue Jackets","Dallas Stars","Detroit Red Wings","Edmonton Oilers","Florida Panthers","Los Angeles Kings","Minnesota Wild","Montreal Canadiens","Nashville Predators","New Jersey Devils","New York Islanders","New York Rangers","Ottawa Senators","Philadelphia Flyers","Pittsburgh Penguins","San Jose Sharks","Seattle Kraken","St. Louis Blues","Tampa Bay Lightning","Toronto Maple Leafs","Utah Mammoth","Vancouver Canucks","Vegas Golden Knights","Washington Capitals","Winnipeg Jets"],
};

export async function fetchTeamSchedule(teamName, league) {
  if (!API_KEY) {
    console.warn("No Ticketmaster API key set — using demo data");
    return null;
  }

  const classification = LEAGUE_TO_CLASSIFICATION[league];
  if (!classification) return null;

  const teamWords = teamName.split(" ");
  const keyword = teamWords[teamWords.length - 1];

  const url = `${BASE_URL}/events.json` +
    `?apikey=${API_KEY}` +
    `&keyword=${encodeURIComponent(keyword)}` +
    `&classificationName=${classification}` +
    `&countryCode=US` +
    `&size=100` +
    `&sort=date,asc`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Ticketmaster API error:", res.status);
      return null;
    }
    const data = await res.json();
    const events = data._embedded?.events || [];

    const cleaned = events
      .map((event, i) => parseEvent(event, teamName, league, i))
      .filter(g => g !== null);

    // Deduplicate: same date + same venue = duplicate listings
    const seen = new Set();
    const unique = [];
    for (const g of cleaned) {
      const key = `${g.dateISO?.slice(0, 10)}-${g.venue}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(g);
      }
    }

    return unique;
  } catch (err) {
    console.warn("Ticketmaster fetch failed:", err);
    return null;
  }
}

function parseEvent(event, teamName, league, i) {
  const name = (event.name || "").toLowerCase();

  for (const keyword of NON_GAME_KEYWORDS) {
    if (name.includes(keyword)) return null;
  }

  const venue = event._embedded?.venues?.[0];
  if (!venue || !venue.location) return null;

  const lat = parseFloat(venue.location.latitude);
  const lng = parseFloat(venue.location.longitude);
  if (!lat || !lng) return null;

  const dateStr = event.dates?.start?.dateTime || event.dates?.start?.localDate;
  if (!dateStr) return null;

  const teamHomeCity = guessTeamHomeCity(teamName);
  const venueCity = venue.city?.name || "";
  const isHome = teamHomeCity && venueCity.toLowerCase().includes(teamHomeCity.toLowerCase());

  // Parse raw opponent from event name, then normalize to official team name
  const opponent = parseOpponent(event.name, teamName, league);
  if (!opponent) return null;

  const priceRange = event.priceRanges?.[0];

  return {
    id: event.id || `tm-${league}-${i}`,
    home: isHome ? teamName : opponent,
    away: isHome ? opponent : teamName,
    isHome,
    dateISO: dateStr,
    venue: venue.name || "TBD",
    city: venue.city?.name && venue.state?.stateCode
      ? `${venue.city.name}, ${venue.state.stateCode}`
      : venue.city?.name || "TBD",
    lat,
    lng,
    ticketsFrom: priceRange ? Math.round(priceRange.min) : null,
    ticketUrl: event.url || null,
    realData: true,
  };
}

/**
 * Find the opponent by scanning the event title for any known team name.
 * Format-agnostic: works for regular season, playoff abbreviations, weird suffixes, etc.
 */
function parseOpponent(eventName, currentTeam, league) {
  if (!eventName) return null;
  const teams = OFFICIAL_TEAMS[league];
  if (!teams) return null;

  const nameLower = eventName.toLowerCase();
  const currentLower = currentTeam.toLowerCase();
  const currentNickname = currentTeam.split(" ").pop().toLowerCase();
  const currentCity = currentTeam.split(" ").slice(0, -1).join(" ").toLowerCase();

  // Walk through every team and see if its full name, nickname, or city appears
  // in the event title. Return the first match that isn't the current team.
  const candidates = [];

  for (const team of teams) {
    if (team === currentTeam) continue;
    const teamLower = team.toLowerCase();
    const nickname = team.split(" ").pop().toLowerCase();
    const city = team.split(" ").slice(0, -1).join(" ").toLowerCase();

    // Skip if nickname matches our current team's nickname (rare, but safe)
    if (nickname === currentNickname) continue;

    // 1. Full team name appears in title? Strongest signal.
    if (nameLower.includes(teamLower)) {
      candidates.push({ team, strength: 3, index: nameLower.indexOf(teamLower) });
      continue;
    }

    // 2. Multi-word nickname like "Red Sox" or "Blue Jays" — also strong.
    const nicknameWords = nickname.split(" ");
    if (nicknameWords.length > 1 && nameLower.includes(nickname)) {
      candidates.push({ team, strength: 2, index: nameLower.indexOf(nickname) });
      continue;
    }

    // 3. Single-word nickname — must appear as a whole word, not inside another.
    const wordRegex = new RegExp(`\\b${nickname}\\b`, "i");
    if (wordRegex.test(nameLower)) {
      candidates.push({ team, strength: 2, index: nameLower.search(wordRegex) });
      continue;
    }

    // 4. City name only — weakest, used as last resort.
    if (city && city !== currentCity) {
      const cityRegex = new RegExp(`\\b${city}\\b`, "i");
      if (cityRegex.test(nameLower)) {
        candidates.push({ team, strength: 1, index: nameLower.search(cityRegex) });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Pick the strongest match. If tied, pick the one that appears first in the title.
  candidates.sort((a, b) => b.strength - a.strength || a.index - b.index);
  return candidates[0].team;
}

/**
 * Match a loose team name like "Reds" or "Cincinnati Reds" or "the Reds"
 * to the official full name from our list ("Cincinnati Reds").
 */
function normalizeTeamName(rawName, league, currentTeam) {
  if (!rawName) return null;
  const teams = OFFICIAL_TEAMS[league];
  if (!teams) return rawName;

  const cleaned = rawName.toLowerCase().trim()
    .replace(/^(the\s+)/i, "")
    .replace(/[^\w\s]/g, "")
    .trim();

  if (!cleaned) return null;

  // Exact match first (case-insensitive)
  for (const team of teams) {
    if (team === currentTeam) continue;
    if (team.toLowerCase() === cleaned) return team;
  }

  // Match by last word (nickname): "Reds" -> "Cincinnati Reds"
  // "Red Sox" / "Blue Jays" / "Blue Jackets" / "Red Wings" -> match last 2 words
  for (const team of teams) {
    if (team === currentTeam) continue;
    const teamLower = team.toLowerCase();
    const teamWords = teamLower.split(" ");
    const cleanedWords = cleaned.split(" ");

    // Try matching just the nickname (last 1 or 2 words of team name)
    const lastWord = teamWords[teamWords.length - 1];
    const lastTwoWords = teamWords.slice(-2).join(" ");

    if (cleaned === lastWord || cleaned === lastTwoWords) return team;
    // Or if rawName contains the team's nickname as a whole word
    if (cleanedWords.includes(lastWord)) return team;
    if (cleaned.includes(lastTwoWords)) return team;
  }

  // Match by city name: "Cincinnati" -> "Cincinnati Reds"
  for (const team of teams) {
    if (team === currentTeam) continue;
    const teamLower = team.toLowerCase();
    const city = teamLower.split(" ").slice(0, -1).join(" ");
    if (city && (cleaned === city || cleaned.startsWith(city + " "))) return team;
  }

  // Couldn't match — return null so this event gets filtered out
  return null;
}

const TEAM_HOME_CITIES = {
  "New England Patriots": "Foxborough",
  "New York Giants": "East Rutherford",
  "New York Jets": "East Rutherford",
  "Los Angeles Rams": "Inglewood",
  "Los Angeles Chargers": "Inglewood",
  "San Francisco 49ers": "Santa Clara",
  "Dallas Cowboys": "Arlington",
  "Washington Commanders": "Landover",
  "Las Vegas Raiders": "Paradise",
  "Tampa Bay Buccaneers": "Tampa",
  "Carolina Panthers": "Charlotte",
  "Tennessee Titans": "Nashville",
  "Arizona Cardinals": "Glendale",
  "Miami Dolphins": "Miami Gardens",
  "Buffalo Bills": "Orchard Park",
  "Minnesota Vikings": "Minneapolis",
  "Atlanta Braves": "Cumberland",
  "Texas Rangers": "Arlington",
  "Athletics": "Sacramento",
};

function guessTeamHomeCity(teamName) {
  if (TEAM_HOME_CITIES[teamName]) return TEAM_HOME_CITIES[teamName];
  const parts = teamName.split(" ");
  return parts.slice(0, -1).join(" ");
}