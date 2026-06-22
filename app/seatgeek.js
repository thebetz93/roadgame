// app/seatgeek.js — best-effort lowest-ticket-price lookup via the SeatGeek
// Platform API. Requires a Platform API client_id (seatgeek.com/account/develop),
// which is different from an affiliate/partner tracking ID. Every call fails
// gracefully (returns {}), so a missing/invalid id simply means no prices show.

const SG_TYPE = {
  nfl: 'nfl',
  nba: 'nba',
  mlb: 'mlb',
  nhl: 'nhl',
  cfb: 'ncaa_football',
};

// Returns a map of "YYYY-MM-DD" → lowest price (number) for the team's
// upcoming events, so callers can match each scheduled game by date.
export async function fetchTeamTicketPrices(teamName, league, clientId) {
  if (!clientId) return {};
  const type = SG_TYPE[league];
  if (!type) return {};

  const today = new Date().toISOString().slice(0, 10);
  const url = `https://api.seatgeek.com/2/events?client_id=${clientId}`
    + `&type=${type}&q=${encodeURIComponent(teamName)}`
    + `&per_page=50&sort=datetime_utc.asc&datetime_utc.gte=${today}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const json = await res.json();
    const map = {};
    (json.events || []).forEach(e => {
      const price = e.stats?.lowest_price;
      if (price == null) return;
      const day = (e.datetime_local || e.datetime_utc || '').slice(0, 10);
      if (!day) return;
      map[day] = map[day] != null ? Math.min(map[day], price) : price;
    });
    return map;
  } catch (err) {
    return {};
  }
}
