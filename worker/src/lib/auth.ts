import type { Context } from "hono";
import { createSupabase, type Bindings } from "./supabase";

export type AuthedUser = { id: string; email: string | null };

function bearerToken(c: Context<{ Bindings: Bindings }>): string | null {
  const header = c.req.header("Authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies a Supabase Auth access token sent by the dashboard. The Worker holds
 * the service key, so every authenticated route must check ownership explicitly —
 * RLS does not apply to service-role queries.
 */
export async function authenticate(
  c: Context<{ Bindings: Bindings }>,
): Promise<AuthedUser | null> {
  const token = bearerToken(c);
  if (!token) return null;

  const supabase = createSupabase(c.env);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    if (error) console.warn("Token verification failed:", error.message);
    return null;
  }

  return { id: data.user.id, email: data.user.email ?? null };
}

export async function ownsForm(
  c: Context<{ Bindings: Bindings }>,
  formId: string,
  userId: string,
): Promise<boolean> {
  const supabase = createSupabase(c.env);
  const { data, error } = await supabase
    .from("forms")
    .select("owner_id")
    .eq("id", formId)
    .maybeSingle();

  if (error || !data) return false;
  return (data as { owner_id: string | null }).owner_id === userId;
}
