import { createClient } from "@supabase/supabase-js";

// Service-role client for the actual write (bypasses RLS).
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// Verify the caller's Supabase access token and return their user id, or null.
// We derive the id from the verified JWT rather than trusting a body field, so a
// caller can only ever read/write their own push subscription.
async function getAuthedUserId(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

export async function POST(req) {
  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

    const { subscription } = await req.json();
    if (!subscription) {
      return Response.json({ error: "missing fields" }, { status: 400 });
    }

    const { error } = await serviceClient()
      .from("profiles")
      .update({ push_subscription: subscription })
      .eq("id", userId);

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

    await serviceClient()
      .from("profiles")
      .update({ push_subscription: null })
      .eq("id", userId);

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
