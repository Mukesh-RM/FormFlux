import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { planFeatures, type Plan } from "@/lib/types";

export const metadata = { title: "Settings" };

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profileData }, { count: formCount }, { count: monthCount }] = await Promise.all([
    supabase.from("profiles").select("plan, created_at").eq("id", user!.id).maybeSingle(),
    supabase.from("forms").select("id", { count: "exact", head: true }),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStartIso()),
  ]);

  const plan: Plan = (profileData as { plan?: string } | null)?.plan === "pro" ? "pro" : "free";
  const features = planFeatures(plan);

  const rows: { label: string; value: string }[] = [
    { label: "Signed in as", value: user?.email ?? "—" },
    { label: "Plan", value: plan === "pro" ? "Pro" : "Free" },
    {
      label: "Forms",
      value:
        features.formLimit === null
          ? `${formCount ?? 0} (unlimited)`
          : `${formCount ?? 0} of ${features.formLimit}`,
    },
    {
      label: "Submissions this month",
      value:
        features.monthlySubmissions === null
          ? `${monthCount ?? 0} (unlimited)`
          : `${monthCount ?? 0} of ${features.monthlySubmissions}`,
    },
  ];

  return (
    <>
      <PageHeader title="Account" description="Your plan, usage, and how FormFlux handles your data." />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Account</CardTitle>
              {plan === "pro" ? <Badge tone="accent">Pro</Badge> : <Badge>Free</Badge>}
            </div>
            <CardDescription>Usage resets on the first of each month, UTC.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-[0.85rem] text-muted">{row.label}</dt>
                  <dd className="text-[0.9rem] font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
          {plan === "free" ? (
            <div className="border-t px-6 py-4">
              <Button asChild variant="primary" size="sm">
                <Link href="/pricing">
                  <Sparkles />
                  Upgrade to Pro
                </Link>
              </Button>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keeping your email address private</CardTitle>
            <CardDescription>
              How FormFlux gives you the same protection as an invisible or aliased address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-[0.88rem] leading-relaxed text-soft">
            <p>
              Every form gets a UUID endpoint like{" "}
              <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.78rem] dark:bg-stone-800">
                /f/6f2c…
              </code>
              . That UUID is the only thing in your page source, so scrapers never see the address
              submissions are delivered to.
            </p>
            <p>
              The zero-config{" "}
              <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.78rem] dark:bg-stone-800">
                /email/you@example.com
              </code>{" "}
              endpoint is handy for a quick start, but it does put your address in the HTML. Switch
              to the UUID endpoint before going live.
            </p>
            <p>
              Submissions are stored in your own Supabase project under row-level security, and the
              daily retention job deletes anything past each form&apos;s retention window — files
              included.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
