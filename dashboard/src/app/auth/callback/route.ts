import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

/** Magic-link landing route: swaps the code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/forms";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback failed:", error.message);
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  // Users created before the signup trigger existed have no profiles row, which
  // breaks forms.owner_id. Insert-if-missing only: never touches an existing plan.
  const user = data.user;
  if (user) {
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, email: user.email ?? "" }, { onConflict: "id", ignoreDuplicates: true });
    if (profileError) console.error("Profile ensure failed:", profileError.message);
  }

  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/forms"}`);
}
