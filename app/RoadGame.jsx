import { useState, useEffect, useMemo } from "react";
import { fetchTeamSchedule } from "./ticketmaster";
import { findCity, geocodeCity, reverseGeocode } from "./cities";

// ─── BRAND PALETTE (matched to logo) ──────────────────────────────────────────
const BRAND = {
  slate:      "#2D3A42",  // deep slate navy (background)
  slateDark:  "#1F2A30",  // darker slate
  slateLight: "#3B4A52",  // lighter slate (cards)
  cream:      "#F5EFE2",  // ticket cream
  creamDim:   "#D8D2C4",  // muted cream
  green:      "#7CC242",  // signature lime green
  greenDark:  "#5FA82E",  // deeper green
  greenGlow:  "rgba(124,194,66,0.25)",
  charcoal:   "#1F2A30",  // text on cream
  muted:      "#7A8890",  // muted text on slate
  white:      "#FFFFFF",
  red:        "#E84545",  // alerts/urgent
  amber:      "#F2A538",  // road trip tier
};

// ─── STORAGE ABSTRACTION ──────────────────────────────────────────────────────
const memStore = {};
const storage = {
  async get(key) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
        try { const r = await window.storage.get(key); return r && r.value ? r.value : null; } catch (e) { return null; }
      }
      if (typeof localStorage !== "undefined") return localStorage.getItem("roadgame:" + key);
      return memStore[key] || null;
    } catch (e) { return null; }
  },
  async set(key, value) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.set === "function") {
        try { await window.storage.set(key, value); return true; } catch (e) {}
      }
      if (typeof localStorage !== "undefined") { localStorage.setItem("roadgame:" + key, value); return true; }
      memStore[key] = value; return true;
    } catch (e) { return false; }
  },
  async delete(key) {
    try {
      if (typeof window !== "undefined" && window.storage && typeof window.storage.delete === "function") {
        try { await window.storage.delete(key); } catch (e) {}
      }
      if (typeof localStorage !== "undefined") localStorage.removeItem("roadgame:" + key);
      delete memStore[key];
      return true;
    } catch (e) { return false; }
  },
};

// ─── HAVERSINE ────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// ─── VENUE DATABASE ────────────────────────────────────────────────────────────
const VENUES = {
  "Arizona Cardinals":     { v: "State Farm Stadium",        c: "Glendale, AZ",      lat: 33.5276, lng: -112.2626 },
  "Atlanta Falcons":       { v: "Mercedes-Benz Stadium",     c: "Atlanta, GA",       lat: 33.7554, lng: -84.4008 },
  "Baltimore Ravens":      { v: "M&T Bank Stadium",          c: "Baltimore, MD",     lat: 39.2780, lng: -76.6227 },
  "Buffalo Bills":         { v: "Highmark Stadium",          c: "Orchard Park, NY",  lat: 42.7738, lng: -78.7870 },
  "Carolina Panthers":     { v: "Bank of America Stadium",   c: "Charlotte, NC",     lat: 35.2258, lng: -80.8528 },
  "Chicago Bears":         { v: "Soldier Field",             c: "Chicago, IL",       lat: 41.8623, lng: -87.6167 },
  "Cincinnati Bengals":    { v: "Paycor Stadium",            c: "Cincinnati, OH",    lat: 39.0954, lng: -84.5160 },
  "Cleveland Browns":      { v: "Cleveland Browns Stadium",  c: "Cleveland, OH",     lat: 41.5061, lng: -81.6995 },
  "Dallas Cowboys":        { v: "AT&T Stadium",              c: "Arlington, TX",     lat: 32.7473, lng: -97.0945 },
  "Denver Broncos":        { v: "Empower Field",             c: "Denver, CO",        lat: 39.7439, lng: -105.0201 },
  "Detroit Lions":         { v: "Ford Field",                c: "Detroit, MI",       lat: 42.3400, lng: -83.0456 },
  "Green Bay Packers":     { v: "Lambeau Field",             c: "Green Bay, WI",     lat: 44.5013, lng: -88.0622 },
  "Houston Texans":        { v: "NRG Stadium",               c: "Houston, TX",       lat: 29.6847, lng: -95.4107 },
  "Indianapolis Colts":    { v: "Lucas Oil Stadium",         c: "Indianapolis, IN",  lat: 39.7601, lng: -86.1639 },
  "Jacksonville Jaguars":  { v: "EverBank Stadium",          c: "Jacksonville, FL",  lat: 30.3239, lng: -81.6373 },
  "Kansas City Chiefs":    { v: "Arrowhead Stadium",         c: "Kansas City, MO",   lat: 39.0489, lng: -94.4839 },
  "Las Vegas Raiders":     { v: "Allegiant Stadium",         c: "Paradise, NV",      lat: 36.0908, lng: -115.1830 },
  "Los Angeles Chargers":  { v: "SoFi Stadium",              c: "Inglewood, CA",     lat: 33.9534, lng: -118.3387 },
  "Los Angeles Rams":      { v: "SoFi Stadium",              c: "Inglewood, CA",     lat: 33.9534, lng: -118.3387 },
  "Miami Dolphins":        { v: "Hard Rock Stadium",         c: "Miami Gardens, FL", lat: 25.9580, lng: -80.2389 },
  "Minnesota Vikings":     { v: "U.S. Bank Stadium",         c: "Minneapolis, MN",   lat: 44.9738, lng: -93.2580 },
  "New England Patriots":  { v: "Gillette Stadium",          c: "Foxborough, MA",    lat: 42.0909, lng: -71.2643 },
  "New Orleans Saints":    { v: "Caesars Superdome",         c: "New Orleans, LA",   lat: 29.9509, lng: -90.0815 },
  "New York Giants":       { v: "MetLife Stadium",           c: "East Rutherford, NJ", lat: 40.8135, lng: -74.0745 },
  "New York Jets":         { v: "MetLife Stadium",           c: "East Rutherford, NJ", lat: 40.8135, lng: -74.0745 },
  "Philadelphia Eagles":   { v: "Lincoln Financial Field",   c: "Philadelphia, PA",  lat: 39.9008, lng: -75.1675 },
  "Pittsburgh Steelers":   { v: "Acrisure Stadium",          c: "Pittsburgh, PA",    lat: 40.4468, lng: -80.0158 },
  "San Francisco 49ers":   { v: "Levi's Stadium",            c: "Santa Clara, CA",   lat: 37.4030, lng: -121.9698 },
  "Seattle Seahawks":      { v: "Lumen Field",               c: "Seattle, WA",       lat: 47.5952, lng: -122.3316 },
  "Tampa Bay Buccaneers":  { v: "Raymond James Stadium",     c: "Tampa, FL",         lat: 27.9759, lng: -82.5033 },
  "Tennessee Titans":      { v: "Nissan Stadium",            c: "Nashville, TN",     lat: 36.1665, lng: -86.7713 },
  "Washington Commanders": { v: "Northwest Stadium",         c: "Landover, MD",      lat: 38.9077, lng: -76.8645 },
  "Atlanta Hawks":            { v: "State Farm Arena",     c: "Atlanta, GA",        lat: 33.7573, lng: -84.3963 },
  "Boston Celtics":           { v: "TD Garden",            c: "Boston, MA",         lat: 42.3662, lng: -71.0621 },
  "Brooklyn Nets":            { v: "Barclays Center",      c: "Brooklyn, NY",       lat: 40.6826, lng: -73.9754 },
  "Charlotte Hornets":        { v: "Spectrum Center",      c: "Charlotte, NC",      lat: 35.2251, lng: -80.8392 },
  "Chicago Bulls":            { v: "United Center",        c: "Chicago, IL",        lat: 41.8806, lng: -87.6742 },
  "Cleveland Cavaliers":      { v: "Rocket Mortgage FieldHouse", c: "Cleveland, OH", lat: 41.4964, lng: -81.6882 },
  "Dallas Mavericks":         { v: "American Airlines Center", c: "Dallas, TX",     lat: 32.7905, lng: -96.8104 },
  "Denver Nuggets":           { v: "Ball Arena",           c: "Denver, CO",         lat: 39.7487, lng: -105.0077 },
  "Detroit Pistons":          { v: "Little Caesars Arena", c: "Detroit, MI",        lat: 42.3410, lng: -83.0553 },
  "Golden State Warriors":    { v: "Chase Center",         c: "San Francisco, CA",  lat: 37.7680, lng: -122.3877 },
  "Houston Rockets":          { v: "Toyota Center",        c: "Houston, TX",        lat: 29.7508, lng: -95.3621 },
  "Indiana Pacers":           { v: "Gainbridge Fieldhouse", c: "Indianapolis, IN",  lat: 39.7640, lng: -86.1555 },
  "LA Clippers":              { v: "Intuit Dome",          c: "Inglewood, CA",      lat: 33.9446, lng: -118.3414 },
  "Los Angeles Lakers":       { v: "Crypto.com Arena",     c: "Los Angeles, CA",    lat: 34.0430, lng: -118.2673 },
  "Memphis Grizzlies":        { v: "FedExForum",           c: "Memphis, TN",        lat: 35.1382, lng: -90.0506 },
  "Miami Heat":               { v: "Kaseya Center",        c: "Miami, FL",          lat: 25.7814, lng: -80.1870 },
  "Milwaukee Bucks":          { v: "Fiserv Forum",         c: "Milwaukee, WI",      lat: 43.0451, lng: -87.9173 },
  "Minnesota Timberwolves":   { v: "Target Center",        c: "Minneapolis, MN",    lat: 44.9795, lng: -93.2762 },
  "New Orleans Pelicans":     { v: "Smoothie King Center", c: "New Orleans, LA",    lat: 29.9490, lng: -90.0821 },
  "New York Knicks":          { v: "Madison Square Garden", c: "New York, NY",      lat: 40.7505, lng: -73.9934 },
  "Oklahoma City Thunder":    { v: "Paycom Center",        c: "Oklahoma City, OK",  lat: 35.4634, lng: -97.5151 },
  "Orlando Magic":            { v: "Kia Center",           c: "Orlando, FL",        lat: 28.5392, lng: -81.3839 },
  "Philadelphia 76ers":       { v: "Wells Fargo Center",   c: "Philadelphia, PA",   lat: 39.9012, lng: -75.1720 },
  "Phoenix Suns":             { v: "Footprint Center",     c: "Phoenix, AZ",        lat: 33.4457, lng: -112.0712 },
  "Portland Trail Blazers":   { v: "Moda Center",          c: "Portland, OR",       lat: 45.5316, lng: -122.6668 },
  "Sacramento Kings":         { v: "Golden 1 Center",      c: "Sacramento, CA",     lat: 38.5802, lng: -121.4997 },
  "San Antonio Spurs":        { v: "Frost Bank Center",    c: "San Antonio, TX",    lat: 29.4270, lng: -98.4375 },
  "Toronto Raptors":          { v: "Scotiabank Arena",     c: "Toronto, ON",        lat: 43.6435, lng: -79.3791 },
  "Utah Jazz":                { v: "Delta Center",         c: "Salt Lake City, UT", lat: 40.7683, lng: -111.9011 },
  "Washington Wizards":       { v: "Capital One Arena",    c: "Washington, DC",     lat: 38.8981, lng: -77.0209 },
  "Arizona Diamondbacks":   { v: "Chase Field",            c: "Phoenix, AZ",        lat: 33.4453, lng: -112.0667 },
  "Atlanta Braves":         { v: "Truist Park",            c: "Cumberland, GA",     lat: 33.8909, lng: -84.4678 },
  "Baltimore Orioles":      { v: "Oriole Park at Camden Yards", c: "Baltimore, MD", lat: 39.2838, lng: -76.6218 },
  "Boston Red Sox":         { v: "Fenway Park",            c: "Boston, MA",         lat: 42.3467, lng: -71.0972 },
  "Chicago Cubs":           { v: "Wrigley Field",          c: "Chicago, IL",        lat: 41.9484, lng: -87.6553 },
  "Chicago White Sox":      { v: "Rate Field",             c: "Chicago, IL",        lat: 41.8299, lng: -87.6338 },
  "Cincinnati Reds":        { v: "Great American Ball Park", c: "Cincinnati, OH",   lat: 39.0979, lng: -84.5082 },
  "Cleveland Guardians":    { v: "Progressive Field",      c: "Cleveland, OH",      lat: 41.4962, lng: -81.6852 },
  "Colorado Rockies":       { v: "Coors Field",            c: "Denver, CO",         lat: 39.7561, lng: -104.9942 },
  "Detroit Tigers":         { v: "Comerica Park",          c: "Detroit, MI",        lat: 42.3390, lng: -83.0485 },
  "Houston Astros":         { v: "Daikin Park",            c: "Houston, TX",        lat: 29.7572, lng: -95.3556 },
  "Kansas City Royals":     { v: "Kauffman Stadium",       c: "Kansas City, MO",    lat: 39.0517, lng: -94.4803 },
  "Los Angeles Angels":     { v: "Angel Stadium",          c: "Anaheim, CA",        lat: 33.8003, lng: -117.8827 },
  "Los Angeles Dodgers":    { v: "Dodger Stadium",         c: "Los Angeles, CA",    lat: 34.0739, lng: -118.2400 },
  "Miami Marlins":          { v: "loanDepot park",         c: "Miami, FL",          lat: 25.7782, lng: -80.2197 },
  "Milwaukee Brewers":      { v: "American Family Field",  c: "Milwaukee, WI",      lat: 43.0280, lng: -87.9712 },
  "Minnesota Twins":        { v: "Target Field",           c: "Minneapolis, MN",    lat: 44.9817, lng: -93.2776 },
  "New York Mets":          { v: "Citi Field",             c: "New York, NY",       lat: 40.7571, lng: -73.8458 },
  "New York Yankees":       { v: "Yankee Stadium",         c: "New York, NY",       lat: 40.8296, lng: -73.9262 },
  "Athletics":              { v: "Sutter Health Park",     c: "Sacramento, CA",     lat: 38.5800, lng: -121.5128 },
  "Philadelphia Phillies":  { v: "Citizens Bank Park",     c: "Philadelphia, PA",   lat: 39.9061, lng: -75.1665 },
  "Pittsburgh Pirates":     { v: "PNC Park",               c: "Pittsburgh, PA",     lat: 40.4469, lng: -80.0057 },
  "San Diego Padres":       { v: "Petco Park",             c: "San Diego, CA",      lat: 32.7073, lng: -117.1566 },
  "San Francisco Giants":   { v: "Oracle Park",            c: "San Francisco, CA",  lat: 37.7786, lng: -122.3893 },
  "Seattle Mariners":       { v: "T-Mobile Park",          c: "Seattle, WA",        lat: 47.5914, lng: -122.3325 },
  "St. Louis Cardinals":    { v: "Busch Stadium",          c: "St. Louis, MO",      lat: 38.6226, lng: -90.1928 },
  "Tampa Bay Rays":         { v: "George M. Steinbrenner Field", c: "Tampa, FL",    lat: 27.9803, lng: -82.5067 },
  "Texas Rangers":          { v: "Globe Life Field",       c: "Arlington, TX",      lat: 32.7473, lng: -97.0814 },
  "Toronto Blue Jays":      { v: "Rogers Centre",          c: "Toronto, ON",        lat: 43.6414, lng: -79.3894 },
  "Washington Nationals":   { v: "Nationals Park",         c: "Washington, DC",     lat: 38.8729, lng: -77.0074 },
  "Anaheim Ducks":           { v: "Honda Center",           c: "Anaheim, CA",       lat: 33.8078, lng: -117.8765 },
  "Boston Bruins":           { v: "TD Garden",              c: "Boston, MA",        lat: 42.3662, lng: -71.0621 },
  "Buffalo Sabres":          { v: "KeyBank Center",         c: "Buffalo, NY",       lat: 42.8751, lng: -78.8765 },
  "Calgary Flames":          { v: "Scotiabank Saddledome",  c: "Calgary, AB",       lat: 51.0374, lng: -114.0519 },
  "Carolina Hurricanes":     { v: "Lenovo Center",          c: "Raleigh, NC",       lat: 35.8033, lng: -78.7218 },
  "Chicago Blackhawks":      { v: "United Center",          c: "Chicago, IL",       lat: 41.8806, lng: -87.6742 },
  "Colorado Avalanche":      { v: "Ball Arena",             c: "Denver, CO",        lat: 39.7487, lng: -105.0077 },
  "Columbus Blue Jackets":   { v: "Nationwide Arena",       c: "Columbus, OH",      lat: 39.9694, lng: -83.0061 },
  "Dallas Stars":            { v: "American Airlines Center", c: "Dallas, TX",      lat: 32.7905, lng: -96.8104 },
  "Detroit Red Wings":       { v: "Little Caesars Arena",   c: "Detroit, MI",       lat: 42.3410, lng: -83.0553 },
  "Edmonton Oilers":         { v: "Rogers Place",           c: "Edmonton, AB",      lat: 53.5469, lng: -113.4974 },
  "Florida Panthers":        { v: "Amerant Bank Arena",     c: "Sunrise, FL",       lat: 26.1585, lng: -80.3255 },
  "Los Angeles Kings":       { v: "Crypto.com Arena",       c: "Los Angeles, CA",   lat: 34.0430, lng: -118.2673 },
  "Minnesota Wild":          { v: "Grand Casino Arena",     c: "St. Paul, MN",      lat: 44.9447, lng: -93.1011 },
  "Montreal Canadiens":      { v: "Bell Centre",            c: "Montreal, QC",      lat: 45.4961, lng: -73.5693 },
  "Nashville Predators":     { v: "Bridgestone Arena",      c: "Nashville, TN",     lat: 36.1592, lng: -86.7785 },
  "New Jersey Devils":       { v: "Prudential Center",      c: "Newark, NJ",        lat: 40.7336, lng: -74.1711 },
  "New York Islanders":      { v: "UBS Arena",              c: "Elmont, NY",        lat: 40.7152, lng: -73.7261 },
  "New York Rangers":        { v: "Madison Square Garden",  c: "New York, NY",      lat: 40.7505, lng: -73.9934 },
  "Ottawa Senators":         { v: "Canadian Tire Centre",   c: "Ottawa, ON",        lat: 45.2969, lng: -75.9272 },
  "Philadelphia Flyers":     { v: "Xfinity Mobile Arena",   c: "Philadelphia, PA",  lat: 39.9012, lng: -75.1720 },
  "Pittsburgh Penguins":     { v: "PPG Paints Arena",       c: "Pittsburgh, PA",    lat: 40.4395, lng: -79.9893 },
  "San Jose Sharks":         { v: "SAP Center",             c: "San Jose, CA",      lat: 37.3329, lng: -121.9012 },
  "Seattle Kraken":          { v: "Climate Pledge Arena",   c: "Seattle, WA",       lat: 47.6221, lng: -122.3540 },
  "St. Louis Blues":         { v: "Enterprise Center",      c: "St. Louis, MO",     lat: 38.6268, lng: -90.2026 },
  "Tampa Bay Lightning":     { v: "Benchmark International Arena", c: "Tampa, FL",  lat: 27.9427, lng: -82.4519 },
  "Toronto Maple Leafs":     { v: "Scotiabank Arena",       c: "Toronto, ON",       lat: 43.6435, lng: -79.3791 },
  "Utah Mammoth":            { v: "Delta Center",           c: "Salt Lake City, UT", lat: 40.7683, lng: -111.9011 },
  "Vancouver Canucks":       { v: "Rogers Arena",           c: "Vancouver, BC",     lat: 49.2778, lng: -123.1089 },
  "Vegas Golden Knights":    { v: "T-Mobile Arena",         c: "Paradise, NV",      lat: 36.1029, lng: -115.1784 },
  "Washington Capitals":     { v: "Capital One Arena",      c: "Washington, DC",    lat: 38.8981, lng: -77.0209 },
  "Winnipeg Jets":           { v: "Canada Life Centre",     c: "Winnipeg, MB",      lat: 49.8929, lng: -97.1436 },
  "Arsenal":            { v: "Emirates Stadium",    c: "London, UK",      lat: 51.5549, lng: -0.1084 },
  "Chelsea":            { v: "Stamford Bridge",     c: "London, UK",      lat: 51.4816, lng: -0.1909 },
  "Liverpool":          { v: "Anfield",             c: "Liverpool, UK",   lat: 53.4308, lng: -2.9608 },
  "Manchester City":    { v: "Etihad Stadium",      c: "Manchester, UK",  lat: 53.4831, lng: -2.2004 },
  "Manchester United":  { v: "Old Trafford",        c: "Manchester, UK",  lat: 53.4631, lng: -2.2913 },
  "Tottenham":          { v: "Tottenham Hotspur Stadium", c: "London, UK", lat: 51.6043, lng: -0.0664 },
  "Newcastle":          { v: "St James' Park",      c: "Newcastle, UK",   lat: 54.9756, lng: -1.6217 },
  "Aston Villa":        { v: "Villa Park",          c: "Birmingham, UK",  lat: 52.5092, lng: -1.8847 },
};

const CITY_GUIDES = {
  "Nashville, TN": {
    tagline: "Music City — honky-tonks, hot chicken, and good times",
    eat: [
      { name: "Hattie B's Hot Chicken", type: "Iconic hot chicken", price: "$", note: "Get the Damn Hot — bucket-list spicy" },
      { name: "Husk Nashville", type: "Southern fine dining", price: "$$$", note: "Reserve 2+ weeks out" },
      { name: "Prince's Hot Chicken", type: "The original", price: "$", note: "Cash only — worth the wait" },
      { name: "Pancake Pantry", type: "Hillsboro brunch", price: "$$", note: "Sweet potato pancakes" },
    ],
    drink: [
      { name: "Broadway Honky-Tonks", type: "Live music strip", price: "Free cover", note: "Tootsies, Legends, AJ's" },
      { name: "Skull's Rainbow Room", type: "Printers Alley jazz", price: "$$", note: "Old-school vibes" },
      { name: "Bastion", type: "Small cocktail bar", price: "$$$", note: "Reservations required" },
    ],
    see: [
      { name: "Country Music Hall of Fame", type: "Music history", price: "$$", note: "Allow 2-3 hours" },
      { name: "Grand Ole Opry", type: "Live show", price: "$$$", note: "Check showtimes for game weekend" },
      { name: "The Parthenon", type: "Centennial Park", price: "$", note: "Full-scale replica" },
      { name: "Johnny Cash Museum", type: "Downtown", price: "$$", note: "Worth 90 min" },
    ],
  },
  "Pittsburgh, PA": {
    tagline: "Three rivers, steel city soul, and serious sports town",
    eat: [
      { name: "Primanti Bros", type: "Famous sandwich (fries inside)", price: "$", note: "Strip District original" },
      { name: "Pamela's Diner", type: "Pancakes Obama loved", price: "$", note: "Crepe-style hotcakes" },
      { name: "Altius", type: "Mt. Washington fine dining", price: "$$$$", note: "Best skyline view in city" },
    ],
    drink: [
      { name: "Church Brew Works", type: "Brewery in a church", price: "$$", note: "Pierogis and pints" },
      { name: "Hofbräuhaus", type: "South Side beer hall", price: "$$", note: "Walking distance from arena" },
    ],
    see: [
      { name: "Duquesne Incline", type: "City overlook", price: "$", note: "$5 for the view of a lifetime" },
      { name: "Andy Warhol Museum", type: "North Shore", price: "$$", note: "Largest single-artist museum" },
      { name: "Strip District", type: "Food & shopping", price: "Free", note: "Saturday mornings are best" },
    ],
  },
  "Boston, MA": {
    tagline: "History, harbors, and the best clam chowder you'll ever have",
    eat: [
      { name: "Neptune Oyster", type: "Seafood (North End)", price: "$$$", note: "No reservations — go early" },
      { name: "Regina Pizzeria", type: "1926 North End pizza", price: "$$", note: "The original location" },
      { name: "Mike's Pastry", type: "Famous cannoli", price: "$", note: "Pistachio or chocolate chip" },
    ],
    drink: [
      { name: "The Bell in Hand Tavern", type: "Oldest tavern in US (1795)", price: "$$", note: "Near Faneuil Hall" },
      { name: "Drink", type: "Fort Point speakeasy", price: "$$$", note: "No menu — tell them what you like" },
    ],
    see: [
      { name: "Freedom Trail", type: "2.5 mi walk", price: "Free", note: "16 historic sites" },
      { name: "Fenway Park Tour", type: "MLB shrine", price: "$$", note: "Even if you're not here for baseball" },
      { name: "Harvard Square", type: "Cambridge", price: "Free", note: "T to Harvard, walk around" },
    ],
  },
  "New York, NY": {
    tagline: "The city — pick a neighborhood and dive in",
    eat: [
      { name: "Joe's Pizza", type: "NY slice (Greenwich)", price: "$", note: "Cash only, fold the slice" },
      { name: "Katz's Delicatessen", type: "Pastrami sandwich icon", price: "$$", note: "Tip the carver" },
      { name: "Le Bernardin", type: "3-star seafood", price: "$$$$", note: "Reserve 30+ days out" },
    ],
    drink: [
      { name: "Please Don't Tell (PDT)", type: "Speakeasy behind a hot dog joint", price: "$$$", note: "Phone for reservations" },
      { name: "Top of the Rock", type: "Bar with skyline view", price: "$$$", note: "Sunset is unbeatable" },
    ],
    see: [
      { name: "Central Park", type: "843-acre park", price: "Free", note: "Bow Bridge, Bethesda Fountain" },
      { name: "9/11 Memorial", type: "Lower Manhattan", price: "$$", note: "Reserve a time slot" },
      { name: "High Line", type: "Elevated rail park", price: "Free", note: "Sunset walk from 34th to 14th" },
    ],
  },
  "Chicago, IL": {
    tagline: "Deep dish, blues clubs, and the best skyline in America",
    eat: [
      { name: "Lou Malnati's", type: "Deep-dish pizza", price: "$$", note: "Order the butter crust" },
      { name: "Portillo's", type: "Italian beef + Chicago dog", price: "$", note: "No ketchup on the dog. Ever." },
      { name: "Alinea", type: "3-star tasting menu", price: "$$$$", note: "Book 60+ days out" },
    ],
    drink: [
      { name: "The Aviary", type: "Cocktail laboratory", price: "$$$", note: "Reservations required" },
      { name: "Kingston Mines", type: "Live blues club", price: "$$", note: "Open until 4 AM" },
    ],
    see: [
      { name: "Millennium Park / The Bean", type: "Downtown landmark", price: "Free", note: "Crown Fountain at night" },
      { name: "Art Institute", type: "World-class museum", price: "$$", note: "American Gothic + Nighthawks" },
      { name: "Architecture Boat Tour", type: "Chicago River", price: "$$$", note: "90-min CAF tour is the one" },
    ],
  },
  "Los Angeles, CA": {
    tagline: "Beaches, tacos, and Hollywood neon",
    eat: [
      { name: "Bestia", type: "Arts District Italian", price: "$$$", note: "Bone marrow gnocchi" },
      { name: "Grand Central Market", type: "DTLA food hall", price: "$", note: "Eggslut, Sari Sari, Wexler's" },
      { name: "Sushi Gen", type: "Little Tokyo", price: "$$$", note: "Sashimi deluxe lunch" },
    ],
    drink: [
      { name: "Bar Marmont", type: "Chateau Marmont", price: "$$$", note: "Old Hollywood energy" },
      { name: "The Varnish", type: "Speakeasy in DTLA", price: "$$$", note: "Behind Cole's deli" },
    ],
    see: [
      { name: "Griffith Observatory", type: "City + stars view", price: "Free", note: "Sunset hike up" },
      { name: "Venice Beach + Santa Monica", type: "Beach walk", price: "Free", note: "Bike the boardwalk" },
      { name: "The Getty Center", type: "Hilltop museum", price: "Free (parking $)", note: "Half day minimum" },
    ],
  },
};

const DEFAULT_GUIDE = {
  tagline: "Make a weekend of it",
  eat: [
    { name: "Local Top-Rated Restaurant", type: "Check Yelp/Google", price: "$$", note: "Search 'best restaurants' in city" },
    { name: "Stadium District Pub", type: "Pre-game crowd", price: "$$", note: "Walking distance to venue" },
    { name: "Iconic Breakfast Spot", type: "Game-day fuel", price: "$", note: "Open early on game day" },
  ],
  drink: [
    { name: "Local Brewery", type: "Beer scene", price: "$$", note: "Most cities have great craft beer" },
    { name: "Sports Bar Near Venue", type: "Pre/post-game", price: "$$", note: "Watch with fellow fans" },
  ],
  see: [
    { name: "Downtown Walking Tour", type: "City highlights", price: "Free", note: "2-3 hours self-guided" },
    { name: "Top-Rated Local Museum", type: "Indoor option", price: "$$", note: "Good for rainy days" },
    { name: "Main Park or Waterfront", type: "Outdoor space", price: "Free", note: "Stretch your legs" },
  ],
};

function guideFor(city) { return CITY_GUIDES[city] || DEFAULT_GUIDE; }

const LEAGUES = [
  { id: "nfl", name: "NFL", emoji: "🏈", season: "Sep–Jan" },
  { id: "nba", name: "NBA", emoji: "🏀", season: "Oct–Jun" },
  { id: "mlb", name: "MLB", emoji: "⚾", season: "Mar–Oct" },
  { id: "nhl", name: "NHL", emoji: "🏒", season: "Oct–Jun" },
  
];

const TEAMS_BY_LEAGUE = {
  nfl: ["Arizona Cardinals","Atlanta Falcons","Baltimore Ravens","Buffalo Bills","Carolina Panthers","Chicago Bears","Cincinnati Bengals","Cleveland Browns","Dallas Cowboys","Denver Broncos","Detroit Lions","Green Bay Packers","Houston Texans","Indianapolis Colts","Jacksonville Jaguars","Kansas City Chiefs","Las Vegas Raiders","Los Angeles Chargers","Los Angeles Rams","Miami Dolphins","Minnesota Vikings","New England Patriots","New Orleans Saints","New York Giants","New York Jets","Philadelphia Eagles","Pittsburgh Steelers","San Francisco 49ers","Seattle Seahawks","Tampa Bay Buccaneers","Tennessee Titans","Washington Commanders"],
  nba: ["Atlanta Hawks","Boston Celtics","Brooklyn Nets","Charlotte Hornets","Chicago Bulls","Cleveland Cavaliers","Dallas Mavericks","Denver Nuggets","Detroit Pistons","Golden State Warriors","Houston Rockets","Indiana Pacers","LA Clippers","Los Angeles Lakers","Memphis Grizzlies","Miami Heat","Milwaukee Bucks","Minnesota Timberwolves","New Orleans Pelicans","New York Knicks","Oklahoma City Thunder","Orlando Magic","Philadelphia 76ers","Phoenix Suns","Portland Trail Blazers","Sacramento Kings","San Antonio Spurs","Toronto Raptors","Utah Jazz","Washington Wizards"],
  mlb: ["Arizona Diamondbacks","Atlanta Braves","Baltimore Orioles","Boston Red Sox","Chicago Cubs","Chicago White Sox","Cincinnati Reds","Cleveland Guardians","Colorado Rockies","Detroit Tigers","Houston Astros","Kansas City Royals","Los Angeles Angels","Los Angeles Dodgers","Miami Marlins","Milwaukee Brewers","Minnesota Twins","New York Mets","New York Yankees","Athletics","Philadelphia Phillies","Pittsburgh Pirates","San Diego Padres","San Francisco Giants","Seattle Mariners","St. Louis Cardinals","Tampa Bay Rays","Texas Rangers","Toronto Blue Jays","Washington Nationals"],
  nhl: ["Anaheim Ducks","Boston Bruins","Buffalo Sabres","Calgary Flames","Carolina Hurricanes","Chicago Blackhawks","Colorado Avalanche","Columbus Blue Jackets","Dallas Stars","Detroit Red Wings","Edmonton Oilers","Florida Panthers","Los Angeles Kings","Minnesota Wild","Montreal Canadiens","Nashville Predators","New Jersey Devils","New York Islanders","New York Rangers","Ottawa Senators","Philadelphia Flyers","Pittsburgh Penguins","San Jose Sharks","Seattle Kraken","St. Louis Blues","Tampa Bay Lightning","Toronto Maple Leafs","Utah Mammoth","Vancouver Canucks","Vegas Golden Knights","Washington Capitals","Winnipeg Jets"],
  
};

function generateSchedule(team, league) {
  const teams = TEAMS_BY_LEAGUE[league].filter(t => t !== team);
  const meta = {
    nfl:    { games: 17, startMonth: 8, startDay: 7,  dayInterval: 7,   defaultTime: "13:00" },
    nba:    { games: 25, startMonth: 4, startDay: 17, dayInterval: 3,   defaultTime: "19:30" },
    mlb:    { games: 25, startMonth: 4, startDay: 17, dayInterval: 2,   defaultTime: "19:05" },
    nhl:    { games: 22, startMonth: 4, startDay: 17, dayInterval: 3,   defaultTime: "19:00" },
    
  }[league];
  const games = [];
  let day = new Date(2026, meta.startMonth, meta.startDay);
  let seed = team.length;
  for (let i = 0; i < meta.games; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const opp = teams[seed % teams.length];
    const isHome = (seed >> 4) % 2 === 0;
    const home = isHome ? team : opp;
    const away = isHome ? opp : team;
    const venue = VENUES[home];
    if (!venue) { day = new Date(day.getTime() + meta.dayInterval * 86400000); continue; }
    const [hh, mm] = meta.defaultTime.split(":");
    const gameDate = new Date(day);
    gameDate.setHours(parseInt(hh), parseInt(mm), 0, 0);
    games.push({
      id: `${league}-${team}-${i}`, home, away, isHome,
      dateISO: gameDate.toISOString(),
      venue: venue.v, city: venue.c, lat: venue.lat, lng: venue.lng,
    });
    day = new Date(day.getTime() + meta.dayInterval * 86400000);
  }
  return games;
}

function fmtDate(iso) { return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
function fmtTime(iso) { return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
function travelTier(d) {
  if (d < 100) return { label: "LOCAL", color: BRAND.green, bg: BRAND.greenGlow };
  if (d < 400) return { label: "ROAD TRIP", color: BRAND.amber, bg: "rgba(242,165,56,0.15)" };
  if (d < 900) return { label: "LONG HAUL", color: "#E87A3A", bg: "rgba(232,122,58,0.15)" };
  return { label: "FLY", color: "#9BB4E8", bg: "rgba(155,180,232,0.15)" };
}
function modesFor(d) {
  if (d < 80) return ["drive"];
  if (d < 450) return ["drive", "train"];
  return ["fly", "drive"];
}
const TRAVEL = {
  fly:   { icon: "✈", label: "Fly",   color: "#9BB4E8" },
  drive: { icon: "🚗", label: "Drive", color: BRAND.green },
  train: { icon: "🚆", label: "Train", color: BRAND.amber },
};

async function computeAlerts(following, alertRadius, userLat, userLng) {
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 86400000);
  const monthOut = new Date(now.getTime() + 30 * 86400000);

  // Fetch real schedules for all followed teams in parallel
  const schedules = await Promise.all(
    following.map(f => fetchTeamSchedule(f.team, f.league).then(games => ({ team: f.team, league: f.league, games: games || [] })))
  );

  const all = [];
  schedules.forEach(({ team, league, games }) => {
    games.forEach(g => {
      const gameDate = new Date(g.dateISO);
      if (gameDate < now) return;
      const dist = haversine(userLat, userLng, g.lat, g.lng);
      if (dist <= alertRadius && gameDate <= monthOut) {
        all.push({ ...g, dist, team, league, isWeek: gameDate <= weekOut });
      }
    });
  });
  return all.sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO));
}

// ─── LOGO MARK (uses /public/logo.png) ───────────────────────────────────────
function LogoMark({ size = 32 }) {
  return (
    <img
      src="/logo.png"
      alt="RoadGame"
      style={{
        height: size,
        width: "auto",
        display: "block",
        objectFit: "contain",
      }}
    />
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function RoadGame() {

  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState(null);
  const [authCity, setAuthCity] = useState("");
  const [authCoords, setAuthCoords] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [newCity, setNewCity] = useState("");
  const [newCoords, setNewCoords] = useState(null);
  // Location is per-user. Default to Fletcher, NC only as a fallback if profile has none.
  const userLat = user?.lat ?? 35.4443;
  const userLng = user?.lng ?? -82.5098;
  const userCity = user?.city ?? "Fletcher, NC";
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("alerts");
  const [activeLeague, setActiveLeague] = useState("nfl");
  const [search, setSearch] = useState("");
  const [following, setFollowing] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [maxDist, setMaxDist] = useState(2000);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [travelTab, setTravelTab] = useState("tickets");
  const [toast, setToast] = useState(null);

  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertRadius, setAlertRadius] = useState(350);

  useEffect(() => {
    async function loadSession() {
      try {
        const sessionRaw = await storage.get("session");
        if (sessionRaw) {
          const data = JSON.parse(sessionRaw);
          setUser(data);
          const profileRaw = await storage.get(`user:${data.email}`);
          if (profileRaw) {
            const p = JSON.parse(profileRaw);
            setFollowing(p.following || []);
            setAlertsEnabled(p.alertsEnabled ?? true);
            setAlertRadius(p.alertRadius ?? 350);
          }
        }
      } catch (e) {}
      setLoading(false);
    }
    loadSession();
  }, []);

  useEffect(() => {
    if (!user) return;
    const profile = { ...user, following, alertsEnabled, alertRadius };
    storage.set(`user:${user.email}`, JSON.stringify(profile)).catch(() => {});
  }, [following, alertsEnabled, alertRadius, user]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  async function handleAuth() {
    setAuthError(null);
    const email = authEmail.trim().toLowerCase();
    if (!email || !email.includes("@") || !email.includes(".")) { setAuthError("Enter a valid email address"); return; }
    if (authMode === "signup" && !authName.trim()) { setAuthError("Enter your name"); return; }
    if (authMode === "signup" && !authCity.trim()) { setAuthError("Enter your city or use 'Detect my location'"); return; }

    try {
      if (authMode === "signup") {
        const existing = await storage.get(`user:${email}`);
        if (existing) { setAuthError("Account already exists — sign in instead"); return; }

        // Resolve city name to coordinates
        let location = null;
        if (authCoords) {
          location = { lat: authCoords.lat, lng: authCoords.lng, city: authCity.trim() };
        } else {
          const geo = await geocodeCity(authCity.trim());
          if (!geo) { setAuthError(`Couldn't find "${authCity}". Try a major city nearby.`); return; }
          location = { lat: geo.lat, lng: geo.lng, city: geo.name };
        }

        const newUser = {
          email,
          name: authName.trim(),
          createdAt: new Date().toISOString(),
          ...location,
        };
        const profile = { ...newUser, following: [], alertsEnabled: true, alertRadius: 350 };
        const saved = await storage.set(`user:${email}`, JSON.stringify(profile));
        if (!saved) { setAuthError("Couldn't save account — storage unavailable"); return; }
        await storage.set("session", JSON.stringify(newUser));
        setUser(newUser);
        showToast(`Welcome to RoadGame, ${authName.trim().split(" ")[0]}!`);
      } else {
        const existing = await storage.get(`user:${email}`);
        if (!existing) { setAuthError("No account found — sign up first"); return; }
        const p = JSON.parse(existing);
        const session = {
          email: p.email || email,
          name: p.name || "Fan",
          lat: p.lat,
          lng: p.lng,
          city: p.city,
        };
        await storage.set("session", JSON.stringify(session));
        setUser(session);
        setFollowing(p.following || []);
        setAlertsEnabled(p.alertsEnabled ?? true);
        setAlertRadius(p.alertRadius ?? 350);
        showToast(`Welcome back, ${session.name.split(" ")[0]}!`);
      }
      setAuthEmail(""); setAuthName(""); setAuthCity(""); setAuthCoords(null);
    } catch (e) {
      setAuthError(`Error: ${e.message || "Something went wrong"}`);
    }
  }
async function saveNewLocation() {
    if (!newCity.trim()) { showToast("Enter a city first"); return; }

    let location = null;
    if (newCoords) {
      location = { lat: newCoords.lat, lng: newCoords.lng, city: newCity.trim() };
    } else {
      const geo = await geocodeCity(newCity.trim());
      if (!geo) { showToast(`Couldn't find "${newCity}". Try a major city nearby.`); return; }
      location = { lat: geo.lat, lng: geo.lng, city: geo.name };
    }

    const updatedUser = { ...user, ...location };
    setUser(updatedUser);
    await storage.set("session", JSON.stringify(updatedUser));

    // Also update the stored profile so future logins remember
    const profileRaw = await storage.get(`user:${user.email}`);
    if (profileRaw) {
      const profile = JSON.parse(profileRaw);
      await storage.set(`user:${user.email}`, JSON.stringify({ ...profile, ...location }));
    }

    setEditingLocation(false);
    setNewCity("");
    setNewCoords(null);
    showToast(`Location updated to ${location.city}`);
  }

  async function detectNewLocation() {
    if (!navigator.geolocation) {
      showToast("Your browser doesn't support location detection.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const cityName = await reverseGeocode(latitude, longitude);
        setNewCity(cityName || "My Location");
        setNewCoords({ lat: latitude, lng: longitude });
      },
      () => {
        showToast("Location permission denied. Type your city instead.");
      },
      { timeout: 10000 }
    );
  }
  async function detectLocation() {
    setAuthError(null);
    if (!navigator.geolocation) {
      setAuthError("Your browser doesn't support location detection. Type your city instead.");
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const cityName = await reverseGeocode(latitude, longitude);
        setAuthCity(cityName || "My Location");
        setAuthCoords({ lat: latitude, lng: longitude });
        setDetectingLocation(false);
      },
      (err) => {
        setDetectingLocation(false);
        setAuthError("Location permission denied. Type your city instead.");
      },
      { timeout: 10000 }
    );
  }

  async function signOut() {
    await storage.delete("session");
    setUser(null); setFollowing([]); setActiveTeam(null); setView("alerts");
  }

  function toggleFollow(team, league) {
    const exists = following.find(f => f.team === team && f.league === league);
    if (exists) { setFollowing(following.filter(f => !(f.team === team && f.league === league))); showToast(`Unfollowed ${team}`); }
    else { setFollowing([...following, { team, league }]); showToast(`Following ${team}`); }
  }
  function isFollowing(team, league) { return !!following.find(f => f.team === team && f.league === league); }
  function openSchedule(team, league) { setActiveTeam({ team, league }); setExpanded(null); }

  const teamsInLeague = useMemo(() => {
    const list = TEAMS_BY_LEAGUE[activeLeague] || [];
    return list.filter(t => t.toLowerCase().includes(search.toLowerCase()));
  }, [activeLeague, search]);

const [schedule, setSchedule] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSchedule() {
      if (!activeTeam) { setSchedule([]); return; }
      setScheduleLoading(true);

      const realGames = await fetchTeamSchedule(activeTeam.team, activeTeam.league);

      if (cancelled) return;

      if (realGames && realGames.length > 0) {
        const enriched = realGames.map(g => ({
          ...g,
          dist: haversine(userLat, userLng, g.lat, g.lng),
          ticketsFrom: g.ticketsFrom || null,
        }));
        setSchedule(enriched);
      } else {
        // No real games available — show empty state instead of demo data
        setSchedule([]);
      }
      setScheduleLoading(false);
    }
    loadSchedule();
    return () => { cancelled = true; };
  }, [activeTeam, userLat, userLng]);

  const visibleSchedule = useMemo(() => nearbyOnly ? schedule.filter(g => g.dist <= maxDist) : schedule, [schedule, nearbyOnly, maxDist]);
  const reachableCount = schedule.filter(g => g.dist <= maxDist).length;
  const leagueMeta = LEAGUES.find(l => l.id === (activeTeam?.league || activeLeague));

  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function loadAlerts() {
      if (!alertsEnabled || following.length === 0) { setAlerts([]); return; }
      const result = await computeAlerts(following, alertRadius, userLat, userLng);
      if (!cancelled) setAlerts(result);
    }
    loadAlerts();
    return () => { cancelled = true; };
  }, [following, alertRadius, alertsEnabled, userLat, userLng]);
  const weekAlerts = alerts.filter(a => a.isWeek);

  // ─────────────── LOADING ────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BRAND.slate, display: "flex", alignItems: "center", justifyContent: "center", color: BRAND.muted, fontFamily: "'Oswald', sans-serif", letterSpacing: 2 }}>
        LOADING ROADGAME...
      </div>
    );
  }

  // ─────────────── AUTH SCREEN ────────────────
  if (!user) {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: BRAND.slate,
        backgroundImage: `radial-gradient(circle at 20% 20%, ${BRAND.greenGlow} 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(124,194,66,0.08) 0%, transparent 40%)`,
        fontFamily: "'Inter', sans-serif",
        color: BRAND.cream,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
          * { box-sizing: border-box; }
          .ticket-stub { position: relative; }
          .ticket-stub::before, .ticket-stub::after {
            content: ''; position: absolute; width: 16px; height: 16px;
            background: ${BRAND.slate}; border-radius: 50%; top: 50%; transform: translateY(-50%);
          }
          .ticket-stub::before { left: -8px; }
          .ticket-stub::after { right: -8px; }
        `}</style>
        <div style={{ width: "100%", maxWidth: 380 }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <LogoMark size={140} />
            </div>
            <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 14, letterSpacing: 2, textTransform: "uppercase", fontWeight: 500 }}>
              Follow Your Team · Plan The Trip
            </div>
          </div>

          {/* Ticket-shaped auth card */}
          <div className="ticket-stub" style={{
            background: BRAND.cream,
            borderRadius: 12,
            padding: "26px 24px",
            color: BRAND.charcoal,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "rgba(45,58,66,0.08)", borderRadius: 8, padding: 3 }}>
              {[["signin","SIGN IN"],["signup","SIGN UP"]].map(([m, lbl]) => (
                <button key={m} onClick={() => { setAuthMode(m); setAuthError(null); }} style={{
                  flex: 1, padding: "9px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: authMode === m ? BRAND.slate : "transparent",
                  color: authMode === m ? BRAND.cream : BRAND.muted,
                  fontSize: 11, fontWeight: 700, letterSpacing: 1,
                  fontFamily: "'Oswald', sans-serif",
                }}>{lbl}</button>
              ))}
            </div>

            {authMode === "signup" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 10, color: BRAND.muted, marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>Name</label>
                <input type="text" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Your name"
                  style={{
                    width: "100%", padding: "11px 13px", borderRadius: 8,
                    background: BRAND.white, border: `1.5px solid rgba(45,58,66,0.15)`,
                    color: BRAND.charcoal, fontSize: 14, outline: "none", fontWeight: 500,
                    fontFamily: "'Inter', sans-serif",
                  }} />
              </div>
            )}
{authMode === "signup" && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 10, color: BRAND.muted, marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>
                  Your City
                </label>
                <input type="text" value={authCity}
                  onChange={e => { setAuthCity(e.target.value); setAuthCoords(null); }}
                  placeholder="Charlotte, NC"
                  style={{
                    width: "100%", padding: "11px 13px", borderRadius: 8,
                    background: BRAND.white, border: `1.5px solid rgba(45,58,66,0.15)`,
                    color: BRAND.charcoal, fontSize: 14, outline: "none", fontWeight: 500,
                    fontFamily: "'Inter', sans-serif",
                    marginBottom: 6,
                  }} />
                <button type="button" onClick={detectLocation} disabled={detectingLocation}
                  className="oswald"
                  style={{
                    background: "transparent", color: BRAND.greenDark,
                    border: `1px solid ${BRAND.greenDark}`, borderRadius: 7,
                    padding: "6px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1,
                    cursor: "pointer", width: "100%",
                  }}>
                  {detectingLocation ? "DETECTING..." : "📍 USE MY CURRENT LOCATION"}
                </button>
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 10, color: BRAND.muted, marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>Email</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com"
                onKeyDown={e => e.key === "Enter" && handleAuth()}
                style={{
                  width: "100%", padding: "11px 13px", borderRadius: 8,
                  background: BRAND.white, border: `1.5px solid rgba(45,58,66,0.15)`,
                  color: BRAND.charcoal, fontSize: 14, outline: "none", fontWeight: 500,
                  fontFamily: "'Inter', sans-serif",
                }} />
            </div>

            {authError && (
              <div style={{
                background: "rgba(232,69,69,0.08)", border: `1.5px solid ${BRAND.red}`,
                color: BRAND.red, borderRadius: 7, padding: "8px 12px", fontSize: 12, marginBottom: 12, fontWeight: 600,
              }}>{authError}</div>
            )}

            <button onClick={handleAuth} style={{
              width: "100%", padding: "13px", borderRadius: 8, border: "none", cursor: "pointer",
              background: BRAND.green, color: BRAND.charcoal,
              fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
              fontFamily: "'Oswald', sans-serif",
              boxShadow: `0 4px 0 ${BRAND.greenDark}`,
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseDown={e => { e.currentTarget.style.transform = "translateY(2px)"; e.currentTarget.style.boxShadow = `0 2px 0 ${BRAND.greenDark}`; }}
            onMouseUp={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 0 ${BRAND.greenDark}`; }}
            >{authMode === "signup" ? "CREATE ACCOUNT" : "SIGN IN"} →</button>

            {/* Ticket barcode strip */}
            <div style={{ marginTop: 18, display: "flex", justifyContent: "center", gap: 1.5, opacity: 0.4 }}>
              {[3,1,2,4,1,3,2,1,4,2,3,1,2,1,3,4,1,2,3,1,4,2,1,3].map((w, i) => (
                <div key={i} style={{ width: w, height: 24, background: BRAND.charcoal }} />
              ))}
            </div>
            <div style={{ fontSize: 10, color: BRAND.muted, textAlign: "center", marginTop: 12, letterSpacing: 1, fontWeight: 600 }}>
              ADMIT ONE · NO PASSWORD REQUIRED
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────── MAIN APP ────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: BRAND.slate,
      fontFamily: "'Inter', sans-serif",
      color: BRAND.cream,
      paddingBottom: 70,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input[type=range] { height: 4px; accent-color: ${BRAND.green}; }
        .oswald { font-family: 'Oswald', sans-serif; }
      `}</style>

      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
          background: BRAND.cream, color: BRAND.charcoal,
          borderRadius: 8, padding: "9px 18px",
          fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
          zIndex: 100, boxShadow: `0 10px 30px rgba(0,0,0,0.5)`,
          borderLeft: `4px solid ${BRAND.green}`,
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{
        background: BRAND.slateDark,
        borderBottom: `2px solid ${BRAND.green}`,
        padding: "11px 14px", position: "sticky", top: 0, zIndex: 50,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={36} />
          <div style={{ fontSize: 9, color: BRAND.muted, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
            {userCity}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          {weekAlerts.length > 0 && (
            <div style={{
              background: BRAND.green, color: BRAND.charcoal,
              borderRadius: 999, padding: "3px 9px", fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
              fontFamily: "'Oswald', sans-serif",
            }}>● {weekAlerts.length} THIS WEEK</div>
          )}
          <button onClick={() => setView("profile")} style={{
            width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer",
            background: view === "profile" ? BRAND.green : BRAND.slateLight,
            color: view === "profile" ? BRAND.charcoal : BRAND.cream,
            fontSize: 13, fontWeight: 800,
          }}>{user.name[0].toUpperCase()}</button>
        </div>
      </div>

      {/* Tab Bar */}
      {!activeTeam && view !== "profile" && (
        <div style={{ display: "flex", gap: 4, padding: "10px 14px 0", maxWidth: 600, margin: "0 auto" }}>
          {[
            ["alerts","ALERTS", weekAlerts.length],
            ["teams","TEAMS"],
            ["following","FOLLOWING", following.length],
          ].map(([id, lbl, badge]) => (
            <button key={id} onClick={() => setView(id)} className="oswald" style={{
              flex: 1, padding: "9px 6px", borderRadius: 7, border: "none", cursor: "pointer",
              background: view === id ? BRAND.green : BRAND.slateLight,
              color: view === id ? BRAND.charcoal : BRAND.muted,
              fontSize: 12, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap",
            }}>{lbl}{badge ? ` · ${badge}` : ""}</button>
          ))}
        </div>
      )}

      {/* ── PROFILE ── */}
      {view === "profile" && (
        <div style={{ padding: "16px 14px", maxWidth: 500, margin: "0 auto" }}>
          <button onClick={() => setView("alerts")} className="oswald" style={{
            background: BRAND.slateLight, border: "none",
            borderRadius: 7, padding: "6px 12px", color: BRAND.cream,
            fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer", marginBottom: 18,
          }}>← BACK</button>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
            <div style={{
              width: 58, height: 58, borderRadius: 14,
              background: BRAND.green,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, fontWeight: 800, color: BRAND.charcoal,
              fontFamily: "'Oswald', sans-serif",
            }}>{user.name[0].toUpperCase()}</div>
            <div>
              <div className="oswald" style={{ fontSize: 22, fontWeight: 700, color: BRAND.cream, letterSpacing: -0.3 }}>{user.name.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: BRAND.muted, fontWeight: 500 }}>{user.email}</div>
            </div>
          </div>
<SectionCard title="YOUR LOCATION" icon="📍">
            {!editingLocation ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.cream }}>{userCity}</div>
                  <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2, fontWeight: 500 }}>
                    All distances calculated from here
                  </div>
                </div>
                <button onClick={() => { setEditingLocation(true); setNewCity(""); setNewCoords(null); }}
                  className="oswald" style={{
                    background: "transparent",
                    border: `1.5px solid ${BRAND.green}`,
                    color: BRAND.green,
                    borderRadius: 7, padding: "6px 12px",
                    fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
                  }}>CHANGE</button>
              </div>
            ) : (
              <div>
                <label style={{ display: "block", fontSize: 10, color: BRAND.muted, marginBottom: 5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>
                  New City
                </label>
                <input type="text" value={newCity}
                  onChange={e => { setNewCity(e.target.value); setNewCoords(null); }}
                  placeholder="Charlotte, NC"
                  onKeyDown={e => e.key === "Enter" && saveNewLocation()}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    background: BRAND.slateDark,
                    border: `1.5px solid rgba(245,239,226,0.1)`,
                    color: BRAND.cream, fontSize: 14, outline: "none", fontWeight: 500,
                    fontFamily: "'Inter', sans-serif", marginBottom: 8, boxSizing: "border-box",
                  }} />
                <button type="button" onClick={detectNewLocation} className="oswald" style={{
                  background: "transparent", color: BRAND.muted,
                  border: `1px solid ${BRAND.muted}`, borderRadius: 7,
                  padding: "6px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1,
                  cursor: "pointer", width: "100%", marginBottom: 10,
                }}>
                  📍 USE MY CURRENT LOCATION
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setEditingLocation(false); setNewCity(""); setNewCoords(null); }}
                    className="oswald" style={{
                      flex: 1, background: "transparent",
                      border: `1.5px solid ${BRAND.muted}`,
                      color: BRAND.muted,
                      borderRadius: 7, padding: "8px",
                      fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
                    }}>CANCEL</button>
                  <button onClick={saveNewLocation} className="oswald" style={{
                    flex: 1, background: BRAND.green, color: BRAND.charcoal,
                    border: "none", borderRadius: 7, padding: "8px",
                    fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
                    boxShadow: `0 3px 0 ${BRAND.greenDark}`,
                  }}>SAVE</button>
                </div>
              </div>
            )}
          </SectionCard>
          <SectionCard title="ALERT SETTINGS" icon="●">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.cream }}>Weekly alerts</div>
                <div style={{ fontSize: 11, color: BRAND.muted }}>Notify me when teams play nearby</div>
              </div>
              <button onClick={() => setAlertsEnabled(!alertsEnabled)} style={{
                width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                background: alertsEnabled ? BRAND.green : BRAND.slateLight, position: "relative",
                transition: "all 0.15s",
              }}>
                <div style={{
                  position: "absolute", top: 2, left: alertsEnabled ? 22 : 2,
                  width: 20, height: 20, borderRadius: "50%", background: BRAND.cream,
                  transition: "left 0.15s",
                }} />
              </button>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: BRAND.muted, fontWeight: 500 }}>Alert radius</span>
                <span className="oswald" style={{ fontSize: 13, fontWeight: 700, color: BRAND.green, letterSpacing: 0.5 }}>{alertRadius} MI</span>
              </div>
              <input type="range" min={50} max={1000} step={25} value={alertRadius}
                onChange={e => setAlertRadius(Number(e.target.value))} disabled={!alertsEnabled}
                style={{ width: "100%", opacity: alertsEnabled ? 1 : 0.3 }} />
              <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 6, fontWeight: 500 }}>
                Alerts trigger when followed teams play within {alertRadius} mi of {userCity} in the next 7 days.
              </div>
            </div>
          </SectionCard>

          <SectionCard title="YOUR STATS">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <Stat value={following.length} label="TEAMS" />
              <Stat value={alerts.length} label="ALERTS/MO" accent={BRAND.green} />
              <Stat value={weekAlerts.length} label="THIS WEEK" accent={weekAlerts.length > 0 ? BRAND.red : BRAND.cream} />
            </div>
          </SectionCard>

          <button onClick={signOut} className="oswald" style={{
            width: "100%", padding: "12px", borderRadius: 8, border: `1.5px solid ${BRAND.red}`,
            background: "transparent", color: BRAND.red,
            fontSize: 12, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
            marginTop: 10,
          }}>SIGN OUT</button>
        </div>
      )}

      {/* ── ALERTS VIEW ── */}
      {view === "alerts" && !activeTeam && (
        <div style={{ padding: "16px 14px", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ marginBottom: 14 }}>
            <div className="oswald" style={{ fontSize: 22, fontWeight: 700, color: BRAND.cream, letterSpacing: -0.3 }}>
              HEY, {user.name.split(" ")[0].toUpperCase()}.
            </div>
            <div style={{ fontSize: 12, color: BRAND.muted, fontWeight: 500, marginTop: 2 }}>
              {weekAlerts.length > 0
                ? `${weekAlerts.length} game${weekAlerts.length === 1 ? "" : "s"} within ${alertRadius}mi this week`
                : following.length === 0
                ? "Follow teams to get alerts"
                : `No nearby games this week. Watching ${following.length} team${following.length === 1 ? "" : "s"}.`}
            </div>
          </div>

          {following.length === 0 ? (
            <div style={{
              background: BRAND.slateLight, border: `2px dashed ${BRAND.green}`,
              borderRadius: 12, padding: "22px", textAlign: "center",
            }}>
              <LogoMark size={48} />
              <div className="oswald" style={{ fontSize: 16, fontWeight: 700, color: BRAND.cream, letterSpacing: 0.5, marginTop: 10 }}>
                START YOUR ROAD GAME
              </div>
              <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
                Pick your favorite teams. We'll alert you when they play near {userCity.split(",")[0]}.
              </div>
              <button onClick={() => setView("teams")} className="oswald" style={{
                background: BRAND.green, color: BRAND.charcoal, border: "none", borderRadius: 8,
                padding: "10px 20px", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, cursor: "pointer",
                boxShadow: `0 3px 0 ${BRAND.greenDark}`,
              }}>BROWSE TEAMS →</button>
            </div>
          ) : (
            <>
              {weekAlerts.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <SectionHeader>● THIS WEEK</SectionHeader>
                  {weekAlerts.map((a, i) => <AlertCard key={i} alert={a} onTap={() => openSchedule(a.team, a.league)} urgent />)}
                </div>
              )}
              {alerts.filter(a => !a.isWeek).length > 0 && (
                <div>
                  <SectionHeader>COMING UP · NEXT 30 DAYS</SectionHeader>
                  {alerts.filter(a => !a.isWeek).map((a, i) => <AlertCard key={i} alert={a} onTap={() => openSchedule(a.team, a.league)} />)}
                </div>
              )}
              {alerts.length === 0 && (
                <div style={{
                  background: BRAND.slateLight, borderRadius: 11, padding: 22, textAlign: "center",
                  color: BRAND.muted, fontSize: 13, fontWeight: 500,
                }}>
                  Nothing within {alertRadius} mi in the next 30 days.<br />
                  <span style={{ fontSize: 11 }}>Widen your alert radius in your profile.</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TEAMS BROWSER ── */}
      {view === "teams" && !activeTeam && (
        <div style={{ padding: "14px 14px", maxWidth: 600, margin: "0 auto" }}>
          <div className="oswald" style={{ fontSize: 22, fontWeight: 700, color: BRAND.cream, letterSpacing: -0.3 }}>PICK YOUR TEAMS</div>
          <div style={{ fontSize: 11, color: BRAND.muted, marginBottom: 14, fontWeight: 500 }}>5 leagues · 130+ teams</div>

          <div style={{ display: "flex", gap: 5, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
            {LEAGUES.map(l => (
              <button key={l.id} onClick={() => setActiveLeague(l.id)} className="oswald" style={{
                padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: activeLeague === l.id ? BRAND.green : BRAND.slateLight,
                color: activeLeague === l.id ? BRAND.charcoal : BRAND.muted,
                fontSize: 12, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap",
              }}>{l.emoji} {l.name}</button>
            ))}
          </div>

          <input type="text" placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", background: BRAND.slateLight,
              border: `1.5px solid rgba(245,239,226,0.1)`, borderRadius: 8,
              padding: "10px 13px", fontSize: 13, color: BRAND.cream,
              outline: "none", marginBottom: 12, fontWeight: 500,
              fontFamily: "'Inter', sans-serif",
            }} />

          {teamsInLeague.map(team => {
            const venue = VENUES[team];
            const dist = venue ? haversine(userLat, userLng, venue.lat, venue.lng) : null;
            const tier = dist !== null ? travelTier(dist) : null;
            const fav = isFollowing(team, activeLeague);
            return (
              <div key={team} style={{
                background: fav ? "rgba(124,194,66,0.08)" : BRAND.slateLight,
                border: fav ? `1.5px solid ${BRAND.green}` : `1px solid rgba(245,239,226,0.06)`,
                borderRadius: 10, padding: "11px 13px", marginBottom: 6,
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => openSchedule(team, activeLeague)}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.cream }}>{team}</div>
                  {venue && <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 1, fontWeight: 500 }}>{venue.c} · {dist} mi</div>}
                </div>
                {tier && (
                  <div className="oswald" style={{
                    background: tier.bg, color: tier.color,
                    borderRadius: 4, padding: "3px 7px", fontSize: 9, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap",
                  }}>{tier.label}</div>
                )}
                <button onClick={() => toggleFollow(team, activeLeague)} style={{
                  background: fav ? BRAND.green : "transparent",
                  border: `1.5px solid ${fav ? BRAND.green : BRAND.muted}`,
                  color: fav ? BRAND.charcoal : BRAND.muted,
                  borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                  fontFamily: "'Oswald', sans-serif", letterSpacing: 0.5,
                }}>{fav ? "✓" : "+"}</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── FOLLOWING VIEW ── */}
      {view === "following" && !activeTeam && (
        <div style={{ padding: "14px 14px", maxWidth: 600, margin: "0 auto" }}>
          <div className="oswald" style={{ fontSize: 22, fontWeight: 700, color: BRAND.cream, letterSpacing: -0.3 }}>YOUR TEAMS</div>
          <div style={{ fontSize: 11, color: BRAND.muted, marginBottom: 14, fontWeight: 500 }}>{following.length} followed</div>
          {following.length === 0 ? (
            <div style={{ textAlign: "center", padding: 36, color: BRAND.muted, fontSize: 13 }}>
              No teams yet — head to the Teams tab.
            </div>
          ) : following.map((f, i) => {
            const venue = VENUES[f.team];
            const dist = venue ? haversine(userLat, userLng, venue.lat, venue.lng) : null;
            const tier = dist !== null ? travelTier(dist) : null;
            const meta = LEAGUES.find(l => l.id === f.league);
            return (
              <div key={i} onClick={() => openSchedule(f.team, f.league)} style={{
                background: BRAND.slateLight,
                border: `1px solid rgba(245,239,226,0.08)`,
                borderLeft: `4px solid ${BRAND.green}`,
                borderRadius: 10, padding: "13px 14px", marginBottom: 8,
                cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="oswald" style={{ fontSize: 10, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>{meta.emoji} {meta.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.cream, marginTop: 1 }}>{f.team}</div>
                  {venue && <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2, fontWeight: 500 }}>{venue.c} · {dist} mi</div>}
                </div>
                {tier && (
                  <div className="oswald" style={{
                    background: tier.bg, color: tier.color, borderRadius: 4,
                    padding: "3px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap",
                  }}>{tier.label}</div>
                )}
                <div style={{ fontSize: 16, color: BRAND.muted }}>›</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SCHEDULE VIEW ── */}
      {activeTeam && (
        <div style={{ padding: "14px 14px", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <button onClick={() => setActiveTeam(null)} className="oswald" style={{
              background: BRAND.slateLight, border: "none",
              borderRadius: 7, padding: "6px 11px", color: BRAND.cream,
              fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
            }}>← BACK</button>
            <div style={{ flex: 1 }}>
              <div className="oswald" style={{ fontSize: 10, color: BRAND.green, fontWeight: 700, letterSpacing: 1.5 }}>
                {leagueMeta.emoji} {leagueMeta.name} · {leagueMeta.season}
              </div>
              <div className="oswald" style={{ fontSize: 18, fontWeight: 700, color: BRAND.cream, letterSpacing: -0.3, lineHeight: 1.1, marginTop: 2 }}>
                {activeTeam.team.toUpperCase()}
              </div>
            </div>
            <button onClick={() => toggleFollow(activeTeam.team, activeTeam.league)} className="oswald" style={{
              background: isFollowing(activeTeam.team, activeTeam.league) ? BRAND.green : "transparent",
              border: `1.5px solid ${BRAND.green}`,
              color: isFollowing(activeTeam.team, activeTeam.league) ? BRAND.charcoal : BRAND.green,
              borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: 1, cursor: "pointer",
            }}>{isFollowing(activeTeam.team, activeTeam.league) ? "✓ FOLLOWING" : "+ FOLLOW"}</button>
          </div>

          <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
            <Stat value={schedule.length} label="GAMES" />
            <Stat value={reachableCount} label={`WITHIN ${maxDist}MI`} accent={BRAND.green} />
            <Stat value={schedule.length > 0 ? `${Math.min(...schedule.map(g => g.dist))}MI` : "—"} label="NEAREST" accent={BRAND.amber} />
          </div>

          <div style={{
            background: BRAND.slateLight, borderRadius: 10,
            padding: "11px 13px", marginBottom: 14,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span className="oswald" style={{ fontSize: 11, color: BRAND.muted, fontWeight: 700, letterSpacing: 1 }}>REACH DISTANCE</span>
              <label style={{ fontSize: 10, color: BRAND.muted, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontWeight: 500 }}>
                <input type="checkbox" checked={nearbyOnly} onChange={e => setNearbyOnly(e.target.checked)} style={{ accentColor: BRAND.green }} />
                Reachable only
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: BRAND.muted, fontWeight: 500 }}>Max</span>
              <span className="oswald" style={{ fontSize: 13, color: BRAND.green, fontWeight: 700, letterSpacing: 0.5 }}>
                {maxDist >= 2500 ? "ANYWHERE" : `≤ ${maxDist} MI`}
              </span>
            </div>
            <input type="range" min={50} max={2500} step={50} value={maxDist} onChange={e => setMaxDist(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
{scheduleLoading && (
            <div style={{
              background: BRAND.slateLight,
              border: `1.5px solid rgba(124,194,66,0.2)`,
              borderRadius: 12,
              padding: "30px 20px",
              textAlign: "center",
            }}>
              <div className="oswald" style={{
                fontSize: 12, color: BRAND.muted, letterSpacing: 2, fontWeight: 700,
              }}>LOADING REAL SCHEDULE...</div>
            </div>
          )}

          {!scheduleLoading && schedule.length === 0 && (
            <div style={{
              background: BRAND.slateLight,
              border: `2px dashed ${BRAND.green}`,
              borderRadius: 12,
              padding: "32px 20px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏟️</div>
              <div className="oswald" style={{
                fontSize: 18, color: BRAND.cream, letterSpacing: 0.5,
                fontWeight: 700, marginBottom: 6,
              }}>COME BACK NEXT SEASON!</div>
              <div style={{
                fontSize: 13, color: BRAND.muted, fontWeight: 500, lineHeight: 1.5,
                maxWidth: 280, margin: "0 auto",
              }}>
                {activeTeam.team} doesn't have any upcoming games right now.
                Check back when their next season kicks off.
              </div>
              <div className="oswald" style={{
                marginTop: 14, fontSize: 10, color: BRAND.green,
                letterSpacing: 1.5, fontWeight: 700,
              }}>
                {leagueMeta.emoji} {leagueMeta.name} · {leagueMeta.season}
              </div>
            </div>
          )}
          {visibleSchedule.map(game => {
            const tier = travelTier(game.dist);
            const isExpanded = expanded === game.id;
            const reachable = game.dist <= maxDist;
            return (
              <div key={game.id} style={{ marginBottom: isExpanded ? 0 : 7, opacity: reachable ? 1 : 0.4 }}>
                <div onClick={() => { setExpanded(isExpanded ? null : game.id); setTravelTab("tickets"); }} style={{
                  background: isExpanded ? "rgba(124,194,66,0.06)" : BRAND.slateLight,
                  border: isExpanded ? `1.5px solid ${BRAND.green}` : `1px solid rgba(245,239,226,0.06)`,
                  borderLeft: `4px solid ${game.isHome ? BRAND.green : BRAND.amber}`,
                  borderRadius: 10, padding: "11px 13px", cursor: "pointer",
                  borderBottomLeftRadius: isExpanded ? 0 : 10, borderBottomRightRadius: isExpanded ? 0 : 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="oswald" style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>
                          {fmtDate(game.dateISO).toUpperCase()} · {fmtTime(game.dateISO)}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: 1,
                          background: game.isHome ? BRAND.green : "rgba(242,165,56,0.2)",
                          color: game.isHome ? BRAND.charcoal : BRAND.amber,
                          padding: "1px 6px", borderRadius: 3,
                        }}>{game.isHome ? "HOME" : "AWAY"}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.cream }}>
                        {game.isHome ? `vs ${game.away}` : `@ ${game.home}`}
                      </div>
                      <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2, fontWeight: 500 }}>{game.venue} · {game.city}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <div className="oswald" style={{ background: tier.bg, color: tier.color, borderRadius: 4, padding: "2px 7px", fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{tier.label}</div>
                      <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 500 }}>{game.dist} mi</div>
                      <div className="oswald" style={{ fontSize: 14, fontWeight: 700, color: BRAND.green, letterSpacing: 0.3 }}>${game.ticketsFrom}+</div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <ExpandedPanel game={game} activeTeam={activeTeam} travelTab={travelTab} setTravelTab={setTravelTab} userCity={userCity} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: BRAND.slateDark, borderTop: `1px solid ${BRAND.greenGlow}`,
        padding: "7px 14px 12px", textAlign: "center",
      }}>
        <div className="oswald" style={{ fontSize: 9, color: BRAND.muted, letterSpacing: 2, fontWeight: 600 }}>
          ROADGAME · ADMIT ONE
        </div>
      </div>
    </div>
  );
}

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────
function SectionHeader({ children }) {
  return (
    <div className="oswald" style={{
      fontSize: 10, color: BRAND.green, fontWeight: 700, letterSpacing: 2,
      marginBottom: 8, textTransform: "uppercase",
    }}>{children}</div>
  );
}

function SectionCard({ title, icon, children }) {
  return (
    <div style={{
      background: BRAND.slateLight, borderRadius: 11,
      padding: "14px 15px", marginBottom: 12,
    }}>
      <div className="oswald" style={{ fontSize: 10, color: BRAND.green, fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>
        {icon && `${icon} `}{title}
      </div>
      {children}
    </div>
  );
}

function Stat({ value, label, accent = BRAND.cream }) {
  return (
    <div style={{ flex: 1, background: BRAND.slateDark, borderRadius: 8, padding: "9px 10px" }}>
      <div className="oswald" style={{ fontSize: 9, color: BRAND.muted, letterSpacing: 1.2, fontWeight: 700 }}>{label}</div>
      <div className="oswald" style={{ fontSize: 20, fontWeight: 700, color: accent, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function AlertCard({ alert: a, onTap, urgent }) {
  const tier = travelTier(a.dist);
  return (
    <div onClick={onTap} style={{
      background: urgent ? "rgba(232,69,69,0.08)" : BRAND.slateLight,
      border: urgent ? `1.5px solid ${BRAND.red}` : `1px solid rgba(245,239,226,0.06)`,
      borderLeft: `4px solid ${urgent ? BRAND.red : BRAND.green}`,
      borderRadius: 10, padding: "11px 13px", marginBottom: 7,
      cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="oswald" style={{ fontSize: 10, color: urgent ? BRAND.red : BRAND.green, fontWeight: 700, letterSpacing: 1.2, marginBottom: 3 }}>
          {urgent ? "● URGENT · " : ""}{fmtDate(a.dateISO).toUpperCase()} · {fmtTime(a.dateISO)}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.cream }}>
          {a.team} {a.isHome ? `vs ${a.away}` : `@ ${a.home}`}
        </div>
        <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2, fontWeight: 500 }}>{a.city} · {a.dist} mi</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="oswald" style={{ background: tier.bg, color: tier.color, borderRadius: 4, padding: "2px 7px", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>{tier.label}</div>
        <div style={{ fontSize: 14, color: BRAND.muted, marginTop: 4 }}>›</div>
      </div>
    </div>
  );
}

function ExpandedPanel({ game, activeTeam, travelTab, setTravelTab, userCity }) {
  const matchup = game.isHome ? `${activeTeam.team} vs ${game.away}` : `${game.home} vs ${activeTeam.team}`;
  const query = encodeURIComponent(`${matchup} ${game.city}`);
  const guide = guideFor(game.city);

  return (
    <div style={{
      background: BRAND.slateDark,
      border: `1.5px solid ${BRAND.green}`, borderTop: "none",
      borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
      padding: 13, marginBottom: 7,
    }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {[
          ["tickets", "TICKETS"],
          ["city", "CITY"],
          ["hotels", "HOTELS"],
          ["transport", "GO"],
          ["map", "MAP"],
        ].map(([t, lbl]) => (
          <button key={t} onClick={() => setTravelTab(t)} className="oswald" style={{
            padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer",
            background: travelTab === t ? BRAND.green : BRAND.slateLight,
            color: travelTab === t ? BRAND.charcoal : BRAND.muted,
            fontSize: 11, fontWeight: 700, letterSpacing: 1,
          }}>{lbl}</button>
        ))}
      </div>

      {travelTab === "tickets" && (() => {
        const vendors = [
          { name: "Ticketmaster", desc: "Official primary", price: game.ticketsFrom, color: "#026CDF", url: `https://www.ticketmaster.com/search?q=${query}` },
          { name: "StubHub", desc: "Resale guarantee", price: Math.round(game.ticketsFrom * 0.92), color: "#3B1869", url: `https://www.stubhub.com/secure/search?q=${query}` },
          { name: "SeatGeek", desc: "Deal Score rated", price: Math.round(game.ticketsFrom * 1.05), color: "#FF5B49", url: `https://seatgeek.com/search?search=${query}` },
          { name: "Vivid Seats", desc: "Rewards", price: Math.round(game.ticketsFrom * 0.98), color: "#231F20", url: `https://www.vividseats.com/search?searchTerm=${query}` },
        ];
        const cheap = Math.min(...vendors.map(v => v.price));
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ background: BRAND.green, color: BRAND.charcoal, borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="oswald" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5 }}>BEST PRICE</div>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{matchup}</div>
              </div>
              <div className="oswald" style={{ fontSize: 22, fontWeight: 700 }}>${cheap}+</div>
            </div>
            {vendors.map(v => (
              <a key={v.name} href={v.url} target="_blank" rel="noopener noreferrer" style={{
                background: BRAND.slateLight,
                border: v.price === cheap ? `1.5px solid ${BRAND.green}` : `1px solid rgba(245,239,226,0.06)`,
                borderRadius: 8, padding: "10px 12px", textDecoration: "none",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="oswald" style={{ width: 30, height: 30, borderRadius: 6, background: v.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                    {v.name[0]}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.cream }}>{v.name}</div>
                    <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 500 }}>{v.desc}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="oswald" style={{ fontSize: 15, fontWeight: 700, color: v.price === cheap ? BRAND.green : BRAND.cream }}>${v.price}+</div>
                  <div className="oswald" style={{ fontSize: 9, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>BUY →</div>
                </div>
              </a>
            ))}
          </div>
        );
      })()}

      {travelTab === "city" && (
        <div>
          <div style={{
            background: BRAND.cream, color: BRAND.charcoal,
            borderRadius: 10, padding: "11px 13px", marginBottom: 12,
            borderLeft: `4px solid ${BRAND.green}`,
          }}>
            <div className="oswald" style={{ fontSize: 10, color: BRAND.greenDark, fontWeight: 700, letterSpacing: 1.5 }}>CITY GUIDE</div>
            <div className="oswald" style={{ fontSize: 17, fontWeight: 700, color: BRAND.charcoal, marginTop: 1, letterSpacing: -0.3 }}>{game.city.toUpperCase()}</div>
            <div style={{ fontSize: 11, color: "#5A6770", fontStyle: "italic", marginTop: 4, fontWeight: 500 }}>{guide.tagline}</div>
          </div>

          {[
            { key: "eat", title: "WHERE TO EAT", items: guide.eat },
            { key: "drink", title: "WHERE TO DRINK", items: guide.drink },
            { key: "see", title: "WHAT TO DO", items: guide.see },
          ].map(section => (
            <div key={section.key} style={{ marginBottom: 12 }}>
              <SectionHeader>{section.title}</SectionHeader>
              {section.items.map((item, i) => (
                <a key={i} href={`https://www.google.com/search?q=${encodeURIComponent(item.name + " " + game.city)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: "block", textDecoration: "none", background: BRAND.slateLight, borderRadius: 8, padding: "9px 12px", marginBottom: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.cream }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 1, fontWeight: 500 }}>{item.type}</div>
                      <div style={{ fontSize: 10, color: BRAND.green, marginTop: 3, fontStyle: "italic", fontWeight: 500 }}>{item.note}</div>
                    </div>
                    <div className="oswald" style={{
                      fontSize: 10, color: BRAND.amber, fontWeight: 700, flexShrink: 0,
                      background: "rgba(242,165,56,0.12)", padding: "2px 7px", borderRadius: 4, letterSpacing: 0.5,
                    }}>{item.price}</div>
                  </div>
                </a>
              ))}
            </div>
          ))}

          <a href={`https://www.google.com/maps/search/things+to+do+in+${encodeURIComponent(game.city)}`}
            target="_blank" rel="noopener noreferrer" className="oswald"
            style={{
              display: "block", textAlign: "center",
              background: BRAND.green, color: BRAND.charcoal,
              borderRadius: 8, padding: "11px",
              fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textDecoration: "none",
              boxShadow: `0 3px 0 ${BRAND.greenDark}`,
            }}>EXPLORE {game.city.split(",")[0].toUpperCase()} →</a>
        </div>
      )}

      {travelTab === "hotels" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {["Marriott", "Hyatt Place", "Hilton Garden Inn"].map((brand, i) => {
            const price = Math.round(110 + game.dist * 0.04 + i * 25);
            return (
              <a key={i} href={`https://www.google.com/travel/hotels/search?q=${encodeURIComponent(brand + " " + game.city)}`}
                target="_blank" rel="noopener noreferrer" style={{
                background: BRAND.slateLight, borderRadius: 8, padding: "9px 12px", textDecoration: "none",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.cream }}>{brand} {game.city.split(",")[0]}</div>
                  <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 500 }}>{"★".repeat(4 - i)} · {(i + 3) * 0.3}mi from venue</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="oswald" style={{ fontSize: 14, fontWeight: 700, color: BRAND.green }}>${price}</div>
                  <div className="oswald" style={{ fontSize: 9, color: BRAND.green, fontWeight: 700, letterSpacing: 1 }}>BOOK →</div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {travelTab === "transport" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {modesFor(game.dist).map(m => {
            const info = m === "fly"
              ? { est: `~$${Math.round(80 + game.dist * 0.11)}`, time: `${Math.ceil(game.dist / 450)}h`, link: `https://www.google.com/travel/flights/search?q=flights+to+${encodeURIComponent(game.city)}` }
              : m === "drive"
              ? { est: `~$${Math.round(game.dist * 0.17)} gas`, time: `${Math.round(game.dist / 60)}h`, link: `https://www.google.com/maps/dir/${encodeURIComponent(userCity)}/${encodeURIComponent(game.city)}` }
              : { est: `~$${Math.round(25 + game.dist * 0.08)}`, time: `${Math.ceil(game.dist / 70)}h`, link: "https://www.amtrak.com" };
            return (
              <div key={m} style={{ background: BRAND.slateLight, borderLeft: `4px solid ${TRAVEL[m].color}`, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{TRAVEL[m].icon}</span>
                  <div>
                    <div className="oswald" style={{ fontSize: 12, fontWeight: 700, color: BRAND.cream, letterSpacing: 0.5 }}>{TRAVEL[m].label.toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 500 }}>{info.time} · {info.est}</div>
                  </div>
                </div>
                <a href={info.link} target="_blank" rel="noopener noreferrer" className="oswald" style={{
                  background: BRAND.green, color: BRAND.charcoal, borderRadius: 6, padding: "5px 10px",
                  fontSize: 10, fontWeight: 700, letterSpacing: 1, textDecoration: "none",
                }}>SEARCH →</a>
              </div>
            );
          })}
        </div>
      )}

      {travelTab === "map" && (
        <div>
          <div style={{ background: BRAND.slateLight, borderRadius: 10, padding: 14, textAlign: "center", marginBottom: 8, borderLeft: `4px solid ${BRAND.green}` }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>●</div>
            <div className="oswald" style={{ fontSize: 14, fontWeight: 700, color: BRAND.cream, letterSpacing: -0.2 }}>{game.venue.toUpperCase()}</div>
            <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 500 }}>{game.city}</div>
            <div className="oswald" style={{ fontSize: 11, color: BRAND.green, marginTop: 5, fontWeight: 700, letterSpacing: 1 }}>{game.dist} MILES FROM {userCity.toUpperCase()}</div>
          </div>
          <a href={`https://www.google.com/maps/dir/${encodeURIComponent(userCity)}/${encodeURIComponent(game.venue + " " + game.city)}`}
            target="_blank" rel="noopener noreferrer" className="oswald"
            style={{
              display: "block", textAlign: "center", background: BRAND.green, color: BRAND.charcoal,
              borderRadius: 8, padding: "11px", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textDecoration: "none",
              boxShadow: `0 3px 0 ${BRAND.greenDark}`,
            }}>GET DIRECTIONS →</a>
        </div>
      )}
    </div>
  );
}
