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
    return Response.json({ debug: "no_api_key" });
  }

  const day = date.split("T")[0];
  const kw = encodeURIComponent(`${home} ${away}`);
  const url = `${BASE_URL}/events.json?apikey=${API_KEY}` +
    `&keyword=${kw}&startDateTime=${day}T00:00:00Z&endDateTime=${day}T23:59:59Z` +
    `&classificationName=sports&size=5&countryCode=US`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const events = data?._embedded?.events ?? [];
    if (!events.length) {
      return Response.json({ debug: "no_events", status: res.status, total: data?.page?.totalElements, url });
    }
    for (const ev of events) {
      const name = (ev.name || "").toLowerCase();
      if (NON_GAME_KEYWORDS.some(k => name.includes(k))) continue;
      const price = ev.priceRanges?.length
        ? Math.floor(Math.min(...ev.priceRanges.map(r => r.min).filter(Boolean)))
        : null;
      return Response.json({ price: price > 0 ? price : null, url: ev.url || null });
    }
    return Response.json({ debug: "all_filtered", events: events.map(e => e.name) });
  } catch (e) {
    return Response.json({ debug: "fetch_error", message: e.message });
  }
}
