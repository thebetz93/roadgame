import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// Called daily by Vercel Cron at 10:00 UTC (see vercel.json)
export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  const supabase = getSupabase();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, following, push_subscription")
    .not("push_subscription", "is", null)
    .eq("alerts_enabled", true);

  if (error) return Response.json({ error: String(error) }, { status: 500 });

  const sent = [];
  const failed = [];

  for (const profile of profiles || []) {
    if (!profile.push_subscription || !profile.following?.length) continue;

    const payload = JSON.stringify({
      title: "RoadGame",
      body: `Games this week for your teams — check what's nearby.`,
      url: "/",
      icon: "/icon-192.png",
    });

    try {
      await webpush.sendNotification(profile.push_subscription, payload);
      sent.push(profile.id);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from("profiles").update({ push_subscription: null }).eq("id", profile.id);
      }
      failed.push({ id: profile.id, err: String(err) });
    }
  }

  return Response.json({ sent: sent.length, failed: failed.length });
}
