import { fetchTeamTicketPrices } from "../../seatgeek";

const SG_CLIENT_ID = process.env.NEXT_PUBLIC_SEATGEEK_CLIENT_ID;

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const team = searchParams.get("team");
  const league = searchParams.get("league");

  if (!team || !league) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  const map = await fetchTeamTicketPrices(team, league, SG_CLIENT_ID);
  return Response.json(map);
}
