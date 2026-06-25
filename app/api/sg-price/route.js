const SG_CLIENT_ID = process.env.NEXT_PUBLIC_SEATGEEK_CLIENT_ID;

function toSlug(name) {
  return name.toLowerCase()
    .replace(/[.']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const home = searchParams.get("home");
  const away = searchParams.get("away");
  const date = searchParams.get("date");

  if (!home || !away || !date) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }
  if (!SG_CLIENT_ID) {
    return Response.json({});
  }

  const day = date.split("T")[0];
  // Query a ±1 day UTC window so late/West-coast games (which land on the next
  // UTC day) aren't missed, then match on the event's LOCAL date.
  const start = new Date(day);
  start.setDate(start.getDate() - 1);
  const end = new Date(day);
  end.setDate(end.getDate() + 2);
  const gte = start.toISOString().slice(0, 10);
  const lte = end.toISOString().slice(0, 10);

  const homeSlug = toSlug(home);
  const url = `https://api.seatgeek.com/2/events?client_id=${SG_CLIENT_ID}` +
    `&performers.slug=${homeSlug}&datetime_utc.gte=${gte}T00:00:00&datetime_utc.lte=${lte}T00:00:00&per_page=25`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const events = data?.events ?? [];
    // Match the event whose LOCAL date equals the target day
    const ev = events.find(e => (e.datetime_local || "").slice(0, 10) === day) || null;
    if (!ev) return Response.json({});
    // stats.lowest_price is only populated for partners with pricing scope;
    // returns null otherwise (deep-link still works).
    const price = ev.stats?.lowest_price ? Math.floor(ev.stats.lowest_price) : null;
    return Response.json({ price, url: ev.url || null });
  } catch {
    return Response.json({});
  }
}
