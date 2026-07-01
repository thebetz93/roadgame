// League metadata, in-season ordering, and the team roster per league.
// Shared between the mobile and desktop layouts.

export const LEAGUES = [
  { id: "nfl", name: "NFL", emoji: "🏈", season: "Sep–Jan" },
  { id: "nba", name: "NBA", emoji: "🏀", season: "Oct–Jun" },
  { id: "mlb", name: "MLB", emoji: "⚾", season: "Mar–Oct" },
  { id: "nhl", name: "NHL", emoji: "🏒", season: "Oct–Jun" },
  { id: "cfb", name: "CFB", emoji: "🏈", season: "Aug–Jan" },
];

// US popularity ranking — lower = more popular (tiebreaker when 2+ leagues are in-season)
export const LEAGUE_POPULARITY = { nfl: 1, mlb: 2, cfb: 3, nhl: 4, nba: 5 };

export function leagueInSeason(id) {
  const m = new Date().getMonth(); // 0=Jan … 11=Dec
  if (id === "nfl") return m >= 8 || m <= 1;   // Sep–Feb
  if (id === "mlb") return m >= 2 && m <= 9;   // Mar–Oct
  if (id === "nba") return m >= 9 || m <= 4;   // Oct–May (playoffs end before June)
  if (id === "nhl") return m >= 9 || m <= 4;   // Oct–May (Stanley Cup by end of May)
  if (id === "cfb") return m >= 7 || m <= 0;   // Aug–Jan
  return false;
}

export const SORTED_LEAGUES = [...LEAGUES].sort((a, b) => {
  const aIn = leagueInSeason(a.id) ? 0 : 1;
  const bIn = leagueInSeason(b.id) ? 0 : 1;
  if (aIn !== bIn) return aIn - bIn;
  return (LEAGUE_POPULARITY[a.id] ?? 99) - (LEAGUE_POPULARITY[b.id] ?? 99);
});

export const TEAMS_BY_LEAGUE = {
  nfl: ["Arizona Cardinals","Atlanta Falcons","Baltimore Ravens","Buffalo Bills","Carolina Panthers","Chicago Bears","Cincinnati Bengals","Cleveland Browns","Dallas Cowboys","Denver Broncos","Detroit Lions","Green Bay Packers","Houston Texans","Indianapolis Colts","Jacksonville Jaguars","Kansas City Chiefs","Las Vegas Raiders","Los Angeles Chargers","Los Angeles Rams","Miami Dolphins","Minnesota Vikings","New England Patriots","New Orleans Saints","New York Giants","New York Jets","Philadelphia Eagles","Pittsburgh Steelers","San Francisco 49ers","Seattle Seahawks","Tampa Bay Buccaneers","Tennessee Titans","Washington Commanders"],
  nba: ["Atlanta Hawks","Boston Celtics","Brooklyn Nets","Charlotte Hornets","Chicago Bulls","Cleveland Cavaliers","Dallas Mavericks","Denver Nuggets","Detroit Pistons","Golden State Warriors","Houston Rockets","Indiana Pacers","LA Clippers","Los Angeles Lakers","Memphis Grizzlies","Miami Heat","Milwaukee Bucks","Minnesota Timberwolves","New Orleans Pelicans","New York Knicks","Oklahoma City Thunder","Orlando Magic","Philadelphia 76ers","Phoenix Suns","Portland Trail Blazers","Sacramento Kings","San Antonio Spurs","Toronto Raptors","Utah Jazz","Washington Wizards"],
  mlb: ["Arizona Diamondbacks","Atlanta Braves","Baltimore Orioles","Boston Red Sox","Chicago Cubs","Chicago White Sox","Cincinnati Reds","Cleveland Guardians","Colorado Rockies","Detroit Tigers","Houston Astros","Kansas City Royals","Los Angeles Angels","Los Angeles Dodgers","Miami Marlins","Milwaukee Brewers","Minnesota Twins","New York Mets","New York Yankees","Athletics","Philadelphia Phillies","Pittsburgh Pirates","San Diego Padres","San Francisco Giants","Seattle Mariners","St. Louis Cardinals","Tampa Bay Rays","Texas Rangers","Toronto Blue Jays","Washington Nationals"],
  nhl: ["Anaheim Ducks","Boston Bruins","Buffalo Sabres","Calgary Flames","Carolina Hurricanes","Chicago Blackhawks","Colorado Avalanche","Columbus Blue Jackets","Dallas Stars","Detroit Red Wings","Edmonton Oilers","Florida Panthers","Los Angeles Kings","Minnesota Wild","Montreal Canadiens","Nashville Predators","New Jersey Devils","New York Islanders","New York Rangers","Ottawa Senators","Philadelphia Flyers","Pittsburgh Penguins","San Jose Sharks","Seattle Kraken","St. Louis Blues","Tampa Bay Lightning","Toronto Maple Leafs","Utah Mammoth","Vancouver Canucks","Vegas Golden Knights","Washington Capitals","Winnipeg Jets"],
  cfb: ["Alabama Crimson Tide","Arkansas Razorbacks","Auburn Tigers","Florida Gators","Georgia Bulldogs","Kentucky Wildcats","LSU Tigers","Mississippi State Bulldogs","Missouri Tigers","Oklahoma Sooners","Ole Miss Rebels","South Carolina Gamecocks","Tennessee Volunteers","Texas Longhorns","Texas A&M Aggies","Vanderbilt Commodores","Illinois Fighting Illini","Indiana Hoosiers","Iowa Hawkeyes","Maryland Terrapins","Michigan Wolverines","Michigan State Spartans","Minnesota Golden Gophers","Nebraska Cornhuskers","Northwestern Wildcats","Ohio State Buckeyes","Penn State Nittany Lions","Purdue Boilermakers","Rutgers Scarlet Knights","Wisconsin Badgers","UCLA Bruins","USC Trojans","Oregon Ducks","Washington Huskies","Arizona Wildcats","Arizona State Sun Devils","Baylor Bears","BYU Cougars","Cincinnati Bearcats","Colorado Buffaloes","Houston Cougars","Iowa State Cyclones","Kansas Jayhawks","Kansas State Wildcats","Oklahoma State Cowboys","TCU Horned Frogs","Texas Tech Red Raiders","UCF Knights","Utah Utes","West Virginia Mountaineers","Boston College Eagles","Clemson Tigers","Duke Blue Devils","Florida State Seminoles","Georgia Tech Yellow Jackets","Louisville Cardinals","Miami Hurricanes","NC State Wolfpack","North Carolina Tar Heels","Notre Dame Fighting Irish","Pittsburgh Panthers","Syracuse Orange","Virginia Cavaliers","Virginia Tech Hokies","Wake Forest Demon Deacons","Stanford Cardinal","California Golden Bears"],
};
