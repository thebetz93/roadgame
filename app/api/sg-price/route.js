import { fetchSGGameInfo } from "../../seatgeek";

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const home = searchParams.get("home");
  const away = searchParams.get("away");
  const date = searchParams.get("date");

  if (!home || !away || !date) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  const info = await fetchSGGameInfo(home, away, date);
  return Response.json(info ?? {});
}
