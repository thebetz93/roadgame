export const runtime = "edge";

const PRICE_MAP = { 0: "Free", 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

async function nearbySearch(lat, lng, type, key) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  // radius + client-side rating sort. Don't also send rankby — rankby and
  // radius are mutually exclusive in the Places API and including both errors.
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "6000");
  url.searchParams.set("type", type);
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const json = await res.json();
  return (json.results || [])
    .filter(p => p.rating >= 4.0 && p.user_ratings_total >= 50)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3)
    .map(p => ({
      name: p.name,
      type: p.types?.[1]?.replace(/_/g, " ") || p.types?.[0]?.replace(/_/g, " ") || type,
      price: PRICE_MAP[p.price_level] ?? "$$",
      note: `⭐ ${p.rating} · ${p.user_ratings_total.toLocaleString()} reviews`,
      placeId: p.place_id,
    }));
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const key = process.env.GOOGLE_PLACES_API_KEY;

  if (!key) {
    return Response.json({ error: "no_key" }, { status: 200 });
  }
  if (!lat || !lng) {
    return Response.json({ error: "missing_params" }, { status: 400 });
  }

  const [eat, drink, see] = await Promise.all([
    nearbySearch(lat, lng, "restaurant", key),
    nearbySearch(lat, lng, "bar", key),
    nearbySearch(lat, lng, "tourist_attraction", key),
  ]);

  return Response.json({ eat, drink, see }, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
