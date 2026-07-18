import { createClient } from "@supabase/supabase-js";

// Read-only diagnostic for the push-notification pipeline. Hit it on the live
// site to see whether the required env vars are present in the DEPLOYED
// environment (never leaks values) and how many users have a live push
// subscription. Safe to leave deployed, or delete once push is confirmed.

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function GET() {
  const env = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: !!process.env.VAPID_SUBJECT,
    CRON_SECRET: !!process.env.CRON_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // Count profiles that have a stored push subscription.
  let subscriptions = null;
  let subError = null;
  try {
    const { count, error } = await serviceClient()
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("push_subscription", "is", null);
    if (error) subError = String(error.message || error);
    else subscriptions = count ?? 0;
  } catch (e) {
    subError = String(e);
  }

  // Plain-English verdict, most-blocking issue first.
  let summary;
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    summary = "BLOCKED: NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing from the deployed env, so phones can't subscribe at all. Add the VAPID keys in Vercel and redeploy.";
  } else if (!env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    summary = "BLOCKED: the server can't SEND pushes — VAPID_PRIVATE_KEY and/or VAPID_SUBJECT are missing in Vercel.";
  } else if (!env.CRON_SECRET) {
    summary = "BLOCKED: CRON_SECRET is missing, so the daily cron route rejects itself (401) and never sends. Add CRON_SECRET in Vercel and redeploy.";
  } else if (subscriptions === 0) {
    summary = "Config looks complete, but ZERO users have subscribed yet — enable notifications from an installed PWA, then re-check this count.";
  } else if (subscriptions > 0) {
    summary = `Config looks complete and ${subscriptions} subscription(s) are stored. If pushes still aren't arriving, the daily cron send is the place to look next.`;
  } else {
    summary = "Env looks set; couldn't read the subscription count (see subscriptionsError).";
  }

  return Response.json({
    SUMMARY: summary,
    envPresent: env,
    subscriptions,
    subscriptionsError: subError,
    cronSchedule: "10:00 UTC daily (see vercel.json)",
    note: "Values are never exposed — only whether each variable is set.",
  });
}
