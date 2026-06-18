import { createClient } from '@supabase/supabase-js';

// Fallbacks prevent a crash during Next.js SSR when .env.local isn't present.
// Replace these with your real values in .env.local (or Vercel env settings).
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
);

export { supabase };

export async function sendMagicLink(email) {
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') return null;
  return data || null;
}

export async function upsertMyProfile(profile) {
  const { error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' });
  if (error) throw error;
}

export async function signOutSupabase() {
  await supabase.auth.signOut();
}
