import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function POST(req) {
  try {
    const { userId, subscription } = await req.json();
    if (!userId || !subscription) {
      return Response.json({ error: "missing fields" }, { status: 400 });
    }

    const { error } = await getSupabase()
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
    const { userId } = await req.json();
    if (!userId) return Response.json({ error: "missing userId" }, { status: 400 });

    await getSupabase()
      .from("profiles")
      .update({ push_subscription: null })
      .eq("id", userId);

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
