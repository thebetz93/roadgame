// Diagnostic endpoint for ticket pricing. Hit this on the live site to see
// whether the API keys are present in the deployed environment AND what each
// vendor actually returns for a real game. Does NOT leak key values.
//
// Example:
//   /api/ticket-debug
//   /api/ticket-debug?home=New%20York%20Yankees&away=Boston%20Red%20Sox&date=2026-06-28
//
// Safe to leave deployed (read-only, no secrets exposed), or delete once the
// pricing pipeline is confirmed working.

const TM_KEY = process.env.NEXT_PUBLIC_TICKETMASTER_KEY;
const SG_ID = process.env.NEXT_PUBLIC_SEATGEEK_CLIENT_ID;
const TM_BASE = "https://app.ticketmaster.com/discovery/v2";

function toSlug(name) {
  return (name || "").toLowerCase()
    .replace(/[.']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function tmLookup(home, day) {
  if (!TM_KEY) return { ok: false, reason: "no key in environment" };
  const start = new Date(day); start.setDate(start.getDate() - 1);
  const end = new Date(day); end.setDate(end.getDate() + 1);
  const gte = start.toISOString().slice(0, 10);
  const lte = end.toISOString().slice(0, 10);
  const url = `${TM_BASE}/events.json?apikey=${TM_KEY}` +
    `&keyword=${encodeURIComponent(home)}` +
    `&startDateTime=${gte}T00:00:00Z&endDateTime=${lte}T23:59:59Z` +
    `&classificationName=sports&size=20&countryCode=US`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const data = await res.json();
    const events = data?._embedded?.events ?? [];
    const matches = events
      .filter(e => (e.dates?.start?.localDate
        || (e.dates?.start?.dateTime || "").slice(0, 10)) === day)
      .map(e => ({
        name: e.name,
        localDate: e.dates?.start?.localDate,
        hasPriceRanges: !!e.priceRanges?.length,
        lowest: e.priceRanges?.length
          ? Math.floor(Math.min(...e.priceRanges.map(r => r.min).filter(Boolean)))
          : null,
      }));
    return { ok: true, totalReturned: events.length, matchesOnDay: matches.length, matches };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

async function sgLookup(home, day) {
  if (!SG_ID) return { ok: false, reason: "no client_id in environment" };
  const start = new Date(day); start.setDate(start.getDate() - 1);
  const end = new Date(day); end.setDate(end.getDate() + 2);
  const gte = start.toISOString().slice(0, 10);
  const lte = end.toISOString().slice(0, 10);
  const url = `https://api.seatgeek.com/2/events?client_id=${SG_ID}` +
    `&performers.slug=${toSlug(home)}` +
    `&datetime_utc.gte=${gte}T00:00:00&datetime_utc.lte=${lte}T00:00:00&per_page=25`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const data = await res.json();
    const events = data?.events ?? [];
    const matches = events
      .filter(e => (e.datetime_local || "").slice(0, 10) === day)
      .map(e => ({
        title: e.short_title || e.title,
        localDate: (e.datetime_local || "").slice(0, 10),
        // lowest_price is gated — null here means no pricing scope on this id
        lowestPrice: e.stats?.lowest_price ?? null,
        hasUrl: !!e.url,
      }));
    return { ok: true, totalReturned: events.length, matchesOnDay: matches.length, matches };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const home = searchParams.get("home") || "New York Yankees";
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const day = date.split("T")[0];

  const [tm, sg] = await Promise.all([tmLookup(home, day), sgLookup(home, day)]);

  return Response.json({
    keysPresent: {
      ticketmaster: !!TM_KEY,
      seatgeek: !!SG_ID,
    },
    query: { home, day },
    ticketmaster: tm,
    seatgeek: sg,
    hint: "If keysPresent is false, add the env vars in Vercel → Settings → Environment Variables and redeploy. If TM returns matches with hasPriceRanges:true, real prices will show. SeatGeek lowestPrice:null means the client_id lacks affiliate pricing scope.",
  });
}
