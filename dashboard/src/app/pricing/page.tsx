import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/marketing-chrome";
import { UpgradeButton } from "@/components/upgrade-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { FREE_MONTHLY_SUBMISSIONS, type Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

export const runtime = "edge";

export const metadata = {
  title: "Pricing",
  description: "One free form forever. Pro adds uploads, webhooks, autoreply, and analytics.",
};

const FREE = [
  { label: "1 form", included: true },
  { label: `${FREE_MONTHLY_SUBMISSIONS} submissions / month`, included: true },
  { label: "Email delivery via Resend", included: true },
  { label: "Honeypot, blacklist & spam heuristics", included: true },
  { label: "hCaptcha support", included: true },
  { label: "Every special field (_next, _cc, _subject…)", included: true },
  { label: "Submission archive & CSV export", included: true },
  { label: "FormFlux branding on the thank-you page", included: true },
  { label: "File uploads", included: false },
  { label: "Webhooks, Slack & Discord", included: false },
  { label: "Autoreply", included: false },
  { label: "Analytics dashboard", included: false },
];

const PRO = [
  { label: "Unlimited forms", included: true },
  { label: "Unlimited submissions", included: true },
  { label: "File uploads to R2 (10MB per submission)", included: true },
  { label: "Webhooks with retries + delivery log", included: true },
  { label: "Slack & Discord destinations", included: true },
  { label: "Autoreply with templates", included: true },
  { label: "Analytics: volume, spam, captcha, webhooks", included: true },
  { label: "Custom domain for your endpoint", included: true },
  { label: "No FormFlux branding", included: true },
  { label: "Priority email support", included: true },
];

function FeatureList({ items }: { items: { label: string; included: boolean }[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li
          key={item.label}
          className={cn("flex items-start gap-2.5 text-[0.88rem] leading-relaxed", !item.included && "text-ink-faint")}
        >
          {item.included ? (
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Minus className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function PricingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let plan: Plan = "free";
  if (user) {
    const { data } = await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle();
    plan = (data as { plan?: string } | null)?.plan === "pro" ? "pro" : "free";
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tightest sm:text-4xl">
            Simple, honest pricing
          </h1>
          <p className="mx-auto mt-3 max-w-xl leading-relaxed text-muted">
            The free plan is genuinely usable for a personal site. Pro exists for people running real
            traffic through their forms.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="panel rounded-2xl p-7 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Free</h2>
              {plan === "free" && user ? <Badge>Current plan</Badge> : null}
            </div>
            <p className="mt-4 text-3xl font-extrabold tracking-tightest">
              $0
              <span className="text-base font-medium text-muted"> / month</span>
            </p>
            <p className="mt-2 text-[0.85rem] leading-relaxed text-muted">
              For a portfolio, a landing page, or a side project.
            </p>
            <Button asChild variant="secondary" className="mt-6 w-full">
              <Link href={user ? "/forms" : "/login"}>
                {user ? "Go to dashboard" : "Start free"}
              </Link>
            </Button>
            <div className="mt-7 border-t pt-6">
              <FeatureList items={FREE} />
            </div>
          </div>

          <div className="relative rounded-2xl border-2 border-accent-500 bg-[rgb(var(--panel))] p-7 shadow-pop">
            <span className="absolute -top-3 left-7 rounded-full bg-accent-600 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-white">
              Recommended
            </span>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Pro</h2>
              {plan === "pro" ? <Badge tone="accent">Current plan</Badge> : null}
            </div>
            <p className="mt-4 text-3xl font-extrabold tracking-tightest">
              $7
              <span className="text-base font-medium text-muted"> / month</span>
            </p>
            <p className="mt-2 text-[0.85rem] leading-relaxed text-muted">
              Everything unlocked. Cancel any time — your data stays in your Supabase project.
            </p>
            <div className="mt-6">
              <UpgradeButton isSignedIn={Boolean(user)} isPro={plan === "pro"} />
            </div>
            <div className="mt-7 border-t pt-6">
              <FeatureList items={PRO} />
            </div>
          </div>
        </div>

        <section className="mt-16">
          <h2 className="text-xl font-bold tracking-tightest">Questions people actually ask</h2>
          <dl className="mt-6 divide-y">
            {[
              [
                "What happens when I hit the free limit?",
                `Submissions past ${FREE_MONTHLY_SUBMISSIONS} in a month are rejected with a clear upgrade message rather than silently dropped, so you notice immediately. The counter resets on the 1st, UTC.`,
              ],
              [
                "Is there a cap on reading my own submissions?",
                "No. FormSubmit limits archive API calls to 5 a day; FormFlux doesn't, because the data lives in your own Supabase project and is read under row-level security.",
              ],
              [
                "Do I need to pay for Cloudflare or Supabase?",
                "No. FormFlux is designed to run entirely on the free tiers of Cloudflare Workers, R2, KV, Queues, Supabase, and Resend.",
              ],
              [
                "Can I self-host it?",
                "Yes — it's a Cloudflare Worker plus a Next.js app. Deploy the Worker with wrangler and the dashboard to Cloudflare Pages.",
              ],
            ].map(([question, answer]) => (
              <div key={question} className="grid gap-1.5 py-5 sm:grid-cols-[16rem_1fr] sm:gap-8">
                <dt className="text-[0.9rem] font-semibold tracking-tight">{question}</dt>
                <dd className="text-[0.88rem] leading-relaxed text-muted">{answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
