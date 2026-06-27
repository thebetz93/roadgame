const API_KEY = process.env.NEXT_PUBLIC_TICKETMASTER_KEY;
const BASE_URL = "https://app.ticketmaster.com/discovery/v2";

const NON_GAME_KEYWORDS = [
  "club pass", "not a game", "parking", "tailgate", "fan club",
  "social", "experience", "tour", "vip", "premium", "hospitality",
  "member", "season pass", "watch party", "open practice",
  "fan fest", "draft party", "merchandise", "training camp",
];

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const home = searchParams.get("home");
  const away = searchParams.get("away");
  const date = searchParams.get("date");

  if (!home || !away || !date) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }
  if (!API_KEY) {
    return Response.json({});
  }

  const day = date.split("T")[0];
  // Query a ±1 day UTC window so evening/West-coast games (whose UTC start
  // lands on the next calendar day) aren't missed, then match on the event's
  // LOCAL date. A strict same-UTC-day window drops most night games.
  const start = new Date(day);
  start.setDate(start.getDate() - 1);
  const end = new Date(day);
  end.setDate(end.getDate() + 1);
  const gte = start.toISOString().slice(0, 10);
  const lte = end.toISOString().slice(0, 10);

  // Search by home team only — more reliable than both names combined.
  const kw = encodeURIComponent(home);
  const url = `${BASE_URL}/events.json?apikey=${API_KEY}` +
    `&keyword=${kw}&startDateTime=${gte}T00:00:00Z&endDateTime=${lte}T23:59:59Z` +
    `&classificationName=sports&size=20&countryCode=US`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const events = data?._embedded?.events ?? [];
    for (const ev of events) {
      const name = (ev.name || "").toLowerCase();
      if (NON_GAME_KEYWORDS.some(k => name.includes(k))) continue;
      // Only accept the event whose LOCAL date matches the target day.
      const evDay = ev.dates?.start?.localDate
        || (ev.dates?.start?.dateTime || "").slice(0, 10);
      if (evDay !== day) continue;
      const price = ev.priceRanges?.length
        ? Math.floor(Math.min(...ev.priceRanges.map(r => r.min).filter(Boolean)))
        : null;
      return Response.json({ price: price > 0 ? price : null, url: ev.url || null });
    }
    return Response.json({});
  } catch {
    return Response.json({});
  }
}
