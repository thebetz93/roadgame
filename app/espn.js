// app/espn.js — ESPN public schedule API, no API key required
import { VENUES } from './venues';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const SPORT = {
  nfl: 'football/nfl',
  nba: 'basketball/nba',
  mlb: 'baseball/mlb',
  nhl: 'hockey/nhl',
  cfb: 'football/college-football',
};

// Hardcoded ESPN abbreviations — skips the unreliable team-search lookup
const ABBR = {
  // NFL
  "Arizona Cardinals":"ari","Atlanta Falcons":"atl","Baltimore Ravens":"bal",
  "Buffalo Bills":"buf","Carolina Panthers":"car","Chicago Bears":"chi",
  "Cincinnati Bengals":"cin","Cleveland Browns":"cle","Dallas Cowboys":"dal",
  "Denver Broncos":"den","Detroit Lions":"det","Green Bay Packers":"gb",
  "Houston Texans":"hou","Indianapolis Colts":"ind","Jacksonville Jaguars":"jax",
  "Kansas City Chiefs":"kc","Las Vegas Raiders":"lv","Los Angeles Chargers":"lac",
  "Los Angeles Rams":"lar","Miami Dolphins":"mia","Minnesota Vikings":"min",
  "New England Patriots":"ne","New Orleans Saints":"no","New York Giants":"nyg",
  "New York Jets":"nyj","Philadelphia Eagles":"phi","Pittsburgh Steelers":"pit",
  "San Francisco 49ers":"sf","Seattle Seahawks":"sea","Tampa Bay Buccaneers":"tb",
  "Tennessee Titans":"ten","Washington Commanders":"wsh",
  // NBA
  "Atlanta Hawks":"atl","Boston Celtics":"bos","Brooklyn Nets":"bkn",
  "Charlotte Hornets":"cha","Chicago Bulls":"chi","Cleveland Cavaliers":"cle",
  "Dallas Mavericks":"dal","Denver Nuggets":"den","Detroit Pistons":"det",
  "Golden State Warriors":"gs","Houston Rockets":"hou","Indiana Pacers":"ind",
  "LA Clippers":"lac","Los Angeles Lakers":"lal","Memphis Grizzlies":"mem",
  "Miami Heat":"mia","Milwaukee Bucks":"mil","Minnesota Timberwolves":"min",
  "New Orleans Pelicans":"no","New York Knicks":"ny","Oklahoma City Thunder":"okc",
  "Orlando Magic":"orl","Philadelphia 76ers":"phi","Phoenix Suns":"phx",
  "Portland Trail Blazers":"por","Sacramento Kings":"sac","San Antonio Spurs":"sa",
  "Toronto Raptors":"tor","Utah Jazz":"utah","Washington Wizards":"wsh",
  // MLB
  "Arizona Diamondbacks":"ari","Atlanta Braves":"atl","Baltimore Orioles":"bal",
  "Boston Red Sox":"bos","Chicago Cubs":"chc","Chicago White Sox":"cws",
  "Cincinnati Reds":"cin","Cleveland Guardians":"cle","Colorado Rockies":"col",
  "Detroit Tigers":"det","Houston Astros":"hou","Kansas City Royals":"kc",
  "Los Angeles Angels":"laa","Los Angeles Dodgers":"lad","Miami Marlins":"mia",
  "Milwaukee Brewers":"mil","Minnesota Twins":"min","New York Mets":"nym",
  "New York Yankees":"nyy","Athletics":"oak","Philadelphia Phillies":"phi",
  "Pittsburgh Pirates":"pit","San Diego Padres":"sd","San Francisco Giants":"sf",
  "Seattle Mariners":"sea","St. Louis Cardinals":"stl","Tampa Bay Rays":"tb",
  "Texas Rangers":"tex","Toronto Blue Jays":"tor","Washington Nationals":"wsh",
  // NHL
  "Anaheim Ducks":"ana","Boston Bruins":"bos","Buffalo Sabres":"buf",
  "Calgary Flames":"cgy","Carolina Hurricanes":"car","Chicago Blackhawks":"chi",
  "Colorado Avalanche":"col","Columbus Blue Jackets":"cbj","Dallas Stars":"dal",
  "Detroit Red Wings":"det","Edmonton Oilers":"edm","Florida Panthers":"fla",
  "Los Angeles Kings":"lak","Minnesota Wild":"min","Montreal Canadiens":"mtl",
  "Nashville Predators":"nsh","New Jersey Devils":"njd","New York Islanders":"nyi",
  "New York Rangers":"nyr","Ottawa Senators":"ott","Philadelphia Flyers":"phi",
  "Pittsburgh Penguins":"pit","San Jose Sharks":"sjs","Seattle Kraken":"sea",
  "St. Louis Blues":"stl","Tampa Bay Lightning":"tbl","Toronto Maple Leafs":"tor",
  "Utah Mammoth":"uta","Vancouver Canucks":"van","Vegas Golden Knights":"vgk",
  "Washington Capitals":"wsh","Winnipeg Jets":"wpg",
  // CFB - SEC
  "Alabama Crimson Tide":"ala","Arkansas Razorbacks":"ark","Auburn Tigers":"aub",
  "Florida Gators":"fla","Georgia Bulldogs":"uga","Kentucky Wildcats":"uk",
  "LSU Tigers":"lsu","Mississippi State Bulldogs":"msst","Missouri Tigers":"mizzou",
  "Oklahoma Sooners":"okla","Ole Miss Rebels":"miss","South Carolina Gamecocks":"scar",
  "Tennessee Volunteers":"tenn","Texas Longhorns":"tex","Texas A&M Aggies":"tamu",
  "Vanderbilt Commodores":"vand",
  // CFB - Big Ten
  "Illinois Fighting Illini":"ill","Indiana Hoosiers":"ind","Iowa Hawkeyes":"iowa",
  "Maryland Terrapins":"md","Michigan Wolverines":"mich","Michigan State Spartans":"msu",
  "Minnesota Golden Gophers":"minn","Nebraska Cornhuskers":"neb","Northwestern Wildcats":"nw",
  "Ohio State Buckeyes":"osu","Penn State Nittany Lions":"psu","Purdue Boilermakers":"pur",
  "Rutgers Scarlet Knights":"rutg","Wisconsin Badgers":"wis","UCLA Bruins":"ucla",
  "USC Trojans":"usc","Oregon Ducks":"ore","Washington Huskies":"wash",
  // CFB - Big 12
  "Arizona Wildcats":"ariz","Arizona State Sun Devils":"asu","Baylor Bears":"baylor",
  "BYU Cougars":"byu","Cincinnati Bearcats":"cinci","Colorado Buffaloes":"colo",
  "Houston Cougars":"hou","Iowa State Cyclones":"iast","Kansas Jayhawks":"kan",
  "Kansas State Wildcats":"kstate","Oklahoma State Cowboys":"okst","TCU Horned Frogs":"tcu",
  "Texas Tech Red Raiders":"ttu","UCF Knights":"ucf","Utah Utes":"utah",
  "West Virginia Mountaineers":"wvu",
  // CFB - ACC
  "Boston College Eagles":"bc","Clemson Tigers":"clem","Duke Blue Devils":"duke",
  "Florida State Seminoles":"fsu","Georgia Tech Yellow Jackets":"gt","Louisville Cardinals":"lou",
  "Miami Hurricanes":"miami","NC State Wolfpack":"ncst","North Carolina Tar Heels":"unc",
  "Notre Dame Fighting Irish":"nd","Pittsburgh Panthers":"pitt","Syracuse Orange":"syr",
  "Virginia Cavaliers":"uva","Virginia Tech Hokies":"vt","Wake Forest Demon Deacons":"wf",
  "Stanford Cardinal":"stan","California Golden Bears":"cal",
};

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

function season(league) {
  const y = new Date().getFullYear();
  const m = new Date().getMonth();
  // NFL: Jan-Feb → completed season (prev year), Mar+ → upcoming season (this year)
  if (league === 'nfl' || league === 'cfb') return m <= 1 ? y - 1 : y;
  return y;
}

function parseEvent(event, ourTeam) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const dateISO = comp.date || event.date;
  if (!dateISO) return null;

  // Future/scheduled games sometimes omit homeAway; fall back to index order (0=home, 1=away)
  const homeComp = comp.competitors?.find(c => c.homeAway === 'home') || comp.competitors?.[0];
  const awayComp = comp.competitors?.find(c => c.homeAway === 'away') || comp.competitors?.[1];
  if (!homeComp || !awayComp) return null;

  const homeApi = homeComp.team?.displayName;
  const awayApi  = awayComp.team?.displayName;

  const homeKey = resolveVenueKey(homeApi);
  // Don't drop the game if the home team isn't in VENUES (common for CFB non-major opponents)
  // Fall back to ESPN's own venue fields which include city/name for all games
  const venueData = homeKey ? VENUES[homeKey] : null;

  const nick = ourTeam.split(' ').pop().toLowerCase();
  const isHome = (homeApi || '').toLowerCase().includes(nick);
  const awayKey = resolveVenueKey(awayApi) || awayApi;

  const v = comp.venue;
  const city = v?.address?.city && v?.address?.state
    ? `${v.address.city}, ${v.address.state}`
    : v?.address?.city || venueData?.c || 'TBD';

  return {
    id: `espn-${event.id}`,
    home: homeKey || homeApi,
    away: awayKey,
    isHome,
    dateISO,
    venue: v?.fullName || venueData?.v || 'TBD',
    city,
    lat: venueData?.lat ?? null,
    lng: venueData?.lng ?? null,
    ticketsFrom: null,
    realData: true,
  };
}

export async function fetchTeamSchedule(teamName, league) {
  const path = SPORT[league];
  const abbr = ABBR[teamName];
  if (!path || !abbr) {
    console.warn(`[ESPN] no mapping for "${teamName}" (${league})`);
    return fetchFallback(teamName, league);
  }

  const yr = season(league);
  const urls = [
    `${BASE}/${path}/teams/${abbr}/schedule?season=${yr}`,
    `${BASE}/${path}/teams/${abbr}/schedule`,            // no-season fallback
  ];

  const now = new Date();

  for (const url of urls) {
    console.log(`[ESPN] ${teamName} → ${url}`);
    try {
      const res = await fetch(url);
      if (!res.ok) { console.warn(`[ESPN] HTTP ${res.status} for ${url}`); continue; }

      const json = await res.json();
      const events = json.events || [];
      console.log(`[ESPN] ${events.length} total events from ${url}`);
      if (events.length === 0) continue;   // try next URL

      const upcoming = events
        .map(e => parseEvent(e, teamName))
        .filter(g => g !== null && new Date(g.dateISO) > now)
        .sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));

      console.log(`[ESPN] ${upcoming.length} upcoming for ${teamName}`);
      if (upcoming.length > 0) return upcoming;
      // Has events but all are past — don't try more ESPN URLs, go to fallback
      break;
    } catch (err) {
      console.warn('[ESPN] error:', err);
    }
  }

  return fetchFallback(teamName, league);
}

async function fetchFallback(teamName, league) {
  if (!["nfl", "nba", "mlb", "nhl", "cfb"].includes(league)) return [];
  console.log(`[Fallback] trying schedule-fallback for "${teamName}" (${league})`);
  try {
    const res = await fetch(
      `/api/schedule-fallback?team=${encodeURIComponent(teamName)}&league=${league}`
    );
    if (!res.ok) return null;   // network/server error → show error card
    const games = await res.json();
    console.log(`[Fallback] ${games.length} games returned`);
    return games;               // [] is valid (no listings yet), not an error
  } catch {
    return null;                // true fetch failure → show error card
  }
}
