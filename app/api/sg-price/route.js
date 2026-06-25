const SG_CLIENT_ID = process.env.NEXT_PUBLIC_SEATGEEK_CLIENT_ID;

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const home = searchParams.get("home");
  const away = searchParams.get("away");
  const date = searchParams.get("date");

  if (!home || !away || !date) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  if (!SG_CLIENT_ID) {
    return Response.json({ debug: "no_client_id" });
  }

  const day = date.split("T")[0];
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const nextDay = next.toISOString().slice(0, 10);
  const q = encodeURIComponent(`${home} ${away}`);
  const url = `https://api.seatgeek.com/2/events?client_id=${SG_CLIENT_ID}` +
    `&q=${q}&datetime_utc.gte=${day}T00:00:00&datetime_utc.lte=${nextDay}T00:00:00&per_page=5`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const events = data?.events ?? [];
    if (!events.length) {
      return Response.json({ debug: "no_events", status: res.status, meta: data?.meta, url });
    }
    const ev = events[0];
    const price = ev.stats?.lowest_price ? Math.floor(ev.stats.lowest_price) : null;
    return Response.json({ price, url: ev.url || null });
  } catch (e) {
    return Response.json({ debug: "fetch_error", message: e.message });
  }
}
