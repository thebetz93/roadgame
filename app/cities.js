// app/cities.js — Top US cities with coordinates for quick offline lookup.
// For cities not in this list, we fall back to a free geocoding API.

export const US_CITIES = [
  { name: "New York, NY", lat: 40.7128, lng: -74.0060 },
  { name: "Los Angeles, CA", lat: 34.0522, lng: -118.2437 },
  { name: "Chicago, IL", lat: 41.8781, lng: -87.6298 },
  { name: "Houston, TX", lat: 29.7604, lng: -95.3698 },
  { name: "Phoenix, AZ", lat: 33.4484, lng: -112.0740 },
  { name: "Philadelphia, PA", lat: 39.9526, lng: -75.1652 },
  { name: "San Antonio, TX", lat: 29.4241, lng: -98.4936 },
  { name: "San Diego, CA", lat: 32.7157, lng: -117.1611 },
  { name: "Dallas, TX", lat: 32.7767, lng: -96.7970 },
  { name: "Austin, TX", lat: 30.2672, lng: -97.7431 },
  { name: "Jacksonville, FL", lat: 30.3322, lng: -81.6557 },
  { name: "Fort Worth, TX", lat: 32.7555, lng: -97.3308 },
  { name: "Columbus, OH", lat: 39.9612, lng: -82.9988 },
  { name: "Charlotte, NC", lat: 35.2271, lng: -80.8431 },
  { name: "Indianapolis, IN", lat: 39.7684, lng: -86.1581 },
  { name: "San Francisco, CA", lat: 37.7749, lng: -122.4194 },
  { name: "Seattle, WA", lat: 47.6062, lng: -122.3321 },
  { name: "Denver, CO", lat: 39.7392, lng: -104.9903 },
  { name: "Washington, DC", lat: 38.9072, lng: -77.0369 },
  { name: "Nashville, TN", lat: 36.1627, lng: -86.7816 },
  { name: "Oklahoma City, OK", lat: 35.4676, lng: -97.5164 },
  { name: "El Paso, TX", lat: 31.7619, lng: -106.4850 },
  { name: "Boston, MA", lat: 42.3601, lng: -71.0589 },
  { name: "Portland, OR", lat: 45.5152, lng: -122.6784 },
  { name: "Las Vegas, NV", lat: 36.1699, lng: -115.1398 },
  { name: "Detroit, MI", lat: 42.3314, lng: -83.0458 },
  { name: "Memphis, TN", lat: 35.1495, lng: -90.0490 },
  { name: "Louisville, KY", lat: 38.2527, lng: -85.7585 },
  { name: "Baltimore, MD", lat: 39.2904, lng: -76.6122 },
  { name: "Milwaukee, WI", lat: 43.0389, lng: -87.9065 },
  { name: "Albuquerque, NM", lat: 35.0844, lng: -106.6504 },
  { name: "Tucson, AZ", lat: 32.2226, lng: -110.9747 },
  { name: "Fresno, CA", lat: 36.7378, lng: -119.7871 },
  { name: "Sacramento, CA", lat: 38.5816, lng: -121.4944 },
  { name: "Mesa, AZ", lat: 33.4152, lng: -111.8315 },
  { name: "Kansas City, MO", lat: 39.0997, lng: -94.5786 },
  { name: "Atlanta, GA", lat: 33.7490, lng: -84.3880 },
  { name: "Omaha, NE", lat: 41.2565, lng: -95.9345 },
  { name: "Colorado Springs, CO", lat: 38.8339, lng: -104.8214 },
  { name: "Raleigh, NC", lat: 35.7796, lng: -78.6382 },
  { name: "Miami, FL", lat: 25.7617, lng: -80.1918 },
  { name: "Long Beach, CA", lat: 33.7701, lng: -118.1937 },
  { name: "Virginia Beach, VA", lat: 36.8529, lng: -75.9780 },
  { name: "Oakland, CA", lat: 37.8044, lng: -122.2712 },
  { name: "Minneapolis, MN", lat: 44.9778, lng: -93.2650 },
  { name: "Tulsa, OK", lat: 36.1540, lng: -95.9928 },
  { name: "Tampa, FL", lat: 27.9506, lng: -82.4572 },
  { name: "Arlington, TX", lat: 32.7357, lng: -97.1081 },
  { name: "New Orleans, LA", lat: 29.9511, lng: -90.0715 },
  { name: "Wichita, KS", lat: 37.6872, lng: -97.3301 },
  { name: "Bakersfield, CA", lat: 35.3733, lng: -119.0187 },
  { name: "Cleveland, OH", lat: 41.4993, lng: -81.6944 },
  { name: "Aurora, CO", lat: 39.7294, lng: -104.8319 },
  { name: "Anaheim, CA", lat: 33.8366, lng: -117.9143 },
  { name: "Honolulu, HI", lat: 21.3099, lng: -157.8581 },
  { name: "Santa Ana, CA", lat: 33.7455, lng: -117.8677 },
  { name: "Riverside, CA", lat: 33.9533, lng: -117.3962 },
  { name: "Corpus Christi, TX", lat: 27.8006, lng: -97.3964 },
  { name: "Lexington, KY", lat: 38.0406, lng: -84.5037 },
  { name: "Stockton, CA", lat: 37.9577, lng: -121.2908 },
  { name: "St. Paul, MN", lat: 44.9537, lng: -93.0900 },
  { name: "Cincinnati, OH", lat: 39.1031, lng: -84.5120 },
  { name: "St. Louis, MO", lat: 38.6270, lng: -90.1994 },
  { name: "Pittsburgh, PA", lat: 40.4406, lng: -79.9959 },
  { name: "Greensboro, NC", lat: 36.0726, lng: -79.7920 },
  { name: "Lincoln, NE", lat: 40.8136, lng: -96.7026 },
  { name: "Plano, TX", lat: 33.0198, lng: -96.6989 },
  { name: "Anchorage, AK", lat: 61.2181, lng: -149.9003 },
  { name: "Orlando, FL", lat: 28.5383, lng: -81.3792 },
  { name: "Irvine, CA", lat: 33.6846, lng: -117.8265 },
  { name: "Newark, NJ", lat: 40.7357, lng: -74.1724 },
  { name: "Durham, NC", lat: 35.9940, lng: -78.8986 },
  { name: "Chula Vista, CA", lat: 32.6401, lng: -117.0842 },
  { name: "Toledo, OH", lat: 41.6528, lng: -83.5379 },
  { name: "Fort Wayne, IN", lat: 41.0793, lng: -85.1394 },
  { name: "St. Petersburg, FL", lat: 27.7676, lng: -82.6403 },
  { name: "Laredo, TX", lat: 27.5306, lng: -99.4803 },
  { name: "Jersey City, NJ", lat: 40.7178, lng: -74.0431 },
  { name: "Chandler, AZ", lat: 33.3062, lng: -111.8413 },
  { name: "Madison, WI", lat: 43.0731, lng: -89.4012 },
  { name: "Lubbock, TX", lat: 33.5779, lng: -101.8552 },
  { name: "Scottsdale, AZ", lat: 33.4942, lng: -111.9261 },
  { name: "Reno, NV", lat: 39.5296, lng: -119.8138 },
  { name: "Buffalo, NY", lat: 42.8864, lng: -78.8784 },
  { name: "Gilbert, AZ", lat: 33.3528, lng: -111.7890 },
  { name: "Glendale, AZ", lat: 33.5387, lng: -112.1860 },
  { name: "North Las Vegas, NV", lat: 36.1989, lng: -115.1175 },
  { name: "Winston-Salem, NC", lat: 36.0999, lng: -80.2442 },
  { name: "Chesapeake, VA", lat: 36.7682, lng: -76.2875 },
  { name: "Norfolk, VA", lat: 36.8508, lng: -76.2859 },
  { name: "Fremont, CA", lat: 37.5485, lng: -121.9886 },
  { name: "Garland, TX", lat: 32.9126, lng: -96.6389 },
  { name: "Irving, TX", lat: 32.8140, lng: -96.9489 },
  { name: "Hialeah, FL", lat: 25.8576, lng: -80.2781 },
  { name: "Richmond, VA", lat: 37.5407, lng: -77.4360 },
  { name: "Boise, ID", lat: 43.6150, lng: -116.2023 },
  { name: "Spokane, WA", lat: 47.6588, lng: -117.4260 },
  { name: "Baton Rouge, LA", lat: 30.4515, lng: -91.1871 },
  { name: "Tacoma, WA", lat: 47.2529, lng: -122.4443 },
  { name: "San Bernardino, CA", lat: 34.1083, lng: -117.2898 },
  { name: "Modesto, CA", lat: 37.6391, lng: -120.9969 },
  { name: "Fontana, CA", lat: 34.0922, lng: -117.4350 },
  { name: "Des Moines, IA", lat: 41.5868, lng: -93.6250 },
  { name: "Moreno Valley, CA", lat: 33.9425, lng: -117.2297 },
  { name: "Santa Clarita, CA", lat: 34.3917, lng: -118.5426 },
  { name: "Fayetteville, NC", lat: 35.0527, lng: -78.8784 },
  { name: "Birmingham, AL", lat: 33.5186, lng: -86.8104 },
  { name: "Oxnard, CA", lat: 34.1975, lng: -119.1771 },
  { name: "Rochester, NY", lat: 43.1566, lng: -77.6088 },
  { name: "Port St. Lucie, FL", lat: 27.2731, lng: -80.3582 },
  { name: "Grand Rapids, MI", lat: 42.9634, lng: -85.6681 },
  { name: "Huntsville, AL", lat: 34.7304, lng: -86.5861 },
  { name: "Salt Lake City, UT", lat: 40.7608, lng: -111.8910 },
  { name: "Frisco, TX", lat: 33.1507, lng: -96.8236 },
  { name: "Yonkers, NY", lat: 40.9312, lng: -73.8987 },
  { name: "Amarillo, TX", lat: 35.2220, lng: -101.8313 },
  { name: "Glendale, CA", lat: 34.1425, lng: -118.2551 },
  { name: "McKinney, TX", lat: 33.1972, lng: -96.6398 },
  { name: "Montgomery, AL", lat: 32.3668, lng: -86.3000 },
  { name: "Aurora, IL", lat: 41.7606, lng: -88.3201 },
  { name: "Akron, OH", lat: 41.0814, lng: -81.5190 },
  { name: "Little Rock, AR", lat: 34.7465, lng: -92.2896 },
  { name: "Augusta, GA", lat: 33.4735, lng: -82.0105 },
  { name: "Knoxville, TN", lat: 35.9606, lng: -83.9207 },
  { name: "Asheville, NC", lat: 35.5951, lng: -82.5515 },
  { name: "Fletcher, NC", lat: 35.4443, lng: -82.5098 },
  { name: "Hendersonville, NC", lat: 35.3187, lng: -82.4610 },
  { name: "Greenville, SC", lat: 34.8526, lng: -82.3940 },
  { name: "Columbia, SC", lat: 34.0007, lng: -81.0348 },
  { name: "Charleston, SC", lat: 32.7765, lng: -79.9311 },
  { name: "Savannah, GA", lat: 32.0809, lng: -81.0912 },
  { name: "Mobile, AL", lat: 30.6954, lng: -88.0399 },
  { name: "Jackson, MS", lat: 32.2988, lng: -90.1848 },
  { name: "Shreveport, LA", lat: 32.5252, lng: -93.7502 },
  { name: "Lafayette, LA", lat: 30.2241, lng: -92.0198 },
  { name: "Lansing, MI", lat: 42.7325, lng: -84.5555 },
  { name: "Ann Arbor, MI", lat: 42.2808, lng: -83.7430 },
  { name: "Springfield, MO", lat: 37.2090, lng: -93.2923 },
  { name: "Dayton, OH", lat: 39.7589, lng: -84.1916 },
  { name: "Toronto, ON", lat: 43.6532, lng: -79.3832 },
  { name: "Montreal, QC", lat: 45.5017, lng: -73.5673 },
  { name: "Vancouver, BC", lat: 49.2827, lng: -123.1207 },
  { name: "Calgary, AB", lat: 51.0447, lng: -114.0719 },
  { name: "Edmonton, AB", lat: 53.5461, lng: -113.4938 },
  { name: "Ottawa, ON", lat: 45.4215, lng: -75.6972 },
  { name: "Winnipeg, MB", lat: 49.8951, lng: -97.1384 },
];

/**
 * Look up a city by name. Returns coordinates or null if not found.
 * Forgiving match: case-insensitive, accepts city alone or "City, ST".
 */
export function findCity(query) {
  if (!query) return null;
  const q = query.trim().toLowerCase();
  if (!q) return null;

  // Exact match first
  let match = US_CITIES.find(c => c.name.toLowerCase() === q);
  if (match) return match;

  // Match city without state suffix ("charlotte" matches "Charlotte, NC")
  match = US_CITIES.find(c => c.name.toLowerCase().split(",")[0] === q);
  if (match) return match;

  // Starts-with match ("char" matches "Charlotte, NC")
  match = US_CITIES.find(c => c.name.toLowerCase().startsWith(q));
  if (match) return match;

  return null;
}

/**
 * Geocode using a free public API as a fallback for cities not in our list.
 * Uses OpenStreetMap's Nominatim — no API key required, but rate-limited
 * (1 request per second per IP), so use sparingly.
 */
export async function geocodeCity(query) {
  if (!query) return null;

  // Try local database first (instant, no network)
  const local = findCity(query);
  if (local) return local;

  // Fall back to Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us,ca`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length === 0) return null;
    const result = data[0];
    return {
      name: formatDisplayName(result.display_name),
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    };
  } catch (e) {
    return null;
  }
}

const STATE_ABBREV = {
  "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA",
  "Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA",
  "Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA",
  "Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD",
  "Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO",
  "Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ",
  "New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH",
  "Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC",
  "South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT",
  "Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY",
  "District of Columbia":"DC",
};

function formatDisplayName(displayName) {
  // Nominatim returns "Charlotte, Mecklenburg County, North Carolina, United States"
  // We want "Charlotte, NC"
  const parts = displayName.split(",").map(p => p.trim());
  const city = parts[0];
  const state = parts.find(p => STATE_ABBREV[p]);
  if (state) return `${city}, ${STATE_ABBREV[state]}`;
  return parts.slice(0, 2).join(", ");
}

/**
 * Reverse-geocode coordinates from browser geolocation back to a city name.
 * Reads Nominatim's structured address so we return an actual city/town
 * (e.g. "Hendersonville, NC") rather than a county ("Henderson County, NC").
 */
export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const locality = a.city || a.town || a.village || a.hamlet
      || a.municipality || a.suburb || a.county;
    const stateName = a.state;
    if (locality && stateName) {
      const abbr = STATE_ABBREV[stateName];
      return abbr ? `${locality}, ${abbr}` : `${locality}, ${stateName}`;
    }
    return formatDisplayName(data.display_name || "");
  } catch (e) {
    return null;
  }
}