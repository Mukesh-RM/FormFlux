import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/types";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  const plan: Plan = (profile as { plan?: string } | null)?.plan === "pro" ? "pro" : "free";

  return (
    <AppShell email={user.email ?? ""} plan={plan}>
      {children}
    </AppShell>
  );
}
