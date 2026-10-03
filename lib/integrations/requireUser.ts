import { createClient } from "@supabase/supabase-js";

/** Require a signed-in Supabase user before exposing provider operations. */
export async function requireIntegrationUser(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");

  if (!url || !key || !authorization?.startsWith("Bearer ")) return null;

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : data.user;
}
