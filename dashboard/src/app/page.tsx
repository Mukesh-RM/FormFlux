import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clock,
  Paperclip,
  ShieldCheck,
  Webhook,
  Zap,
} from "lucide-react";
import { DemoForm } from "@/components/demo-form";
import { MarketingFooter, MarketingNav } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";

const FEATURES = [
  {
    icon: Zap,
    title: "Zero-config start",
    body: "Point a form at /email/you@example.com, confirm the inbox once, and you're collecting submissions. No SDK, no API key in your markup.",
  },
  {
    icon: ShieldCheck,
    title: "Spam protection that keeps evidence",
    body: "Honeypot, hCaptcha, per-form blocklists, and link/keyword heuristics. Blocked mail is flagged, not deleted, so you can rescue false positives.",
  },
  {
    icon: Paperclip,
    title: "File uploads",
    body: "Up to 10MB per submission stored in Cloudflare R2, with download links right in the notification email.",
  },
  {
    icon: Webhook,
    title: "Webhooks, Slack & Discord",
    body: "Forward every submission as JSON, Slack blocks, or a Discord embed. Failures retry with backoff and every attempt is logged.",
  },
  {
    icon: BarChart3,
    title: "A real dashboard",
    body: "Search your whole history, export CSV, inspect payloads and attachments, and watch submissions-per-day trends.",
  },
  {
    icon: Clock,
    title: "GDPR-friendly retention",
    body: "Set a retention window per form. A daily job deletes anything older, files included. Your data lives in your own Supabase project.",
  },
];

const SNIPPET = `<form action="https://api.formflux.dev/f/YOUR_FORM_ID" method="POST">
  <input name="name" required />
  <input type="email" name="email" required />
  <textarea name="message"></textarea>
  <button>Send</button>
</form>`;

const STEPS = [
  {
    title: "Create a form",
    body: "Sign in with a magic link and name your form. You get a UUID endpoint that keeps your email out of your page source.",
  },
  {
    title: "Paste the endpoint",
    body: "Drop it into your form's action attribute. Plain HTML works; so does fetch() if you prefer AJAX.",
  },
  {
    title: "Get the submission",
    body: "It lands in your inbox, hits your webhooks, and shows up in your dashboard — usually in under a second.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-gradient-to-b from-accent-100/60 to-transparent blur-3xl dark:from-accent-950/40"
            aria-hidden
          />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-16">
            <div className="animate-fade-in">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-[0.75rem] font-semibold text-accent-700 dark:border-accent-900 dark:bg-accent-950/40 dark:text-accent-300">
                Free tier, no credit card
              </span>
              <h1 className="mt-5 text-[2.4rem] font-extrabold leading-[1.08] tracking-tightest sm:text-[3.25rem]">
                Your HTML form,
                <br />
                <span className="text-accent-600 dark:text-accent-400">already working.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-soft">
                FormFlux turns any <code className="font-mono text-[0.95em]">&lt;form&gt;</code> into
                a real backend: email delivery, spam filtering, file uploads, webhooks, and a
                dashboard. No server to write, no service to babysit.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild variant="primary" size="lg">
                  <Link href="/login">
                    Start free
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <Link href="/docs">Read the docs</Link>
                </Button>
              </div>

              <div className="mt-10 overflow-hidden rounded-xl border bg-stone-900">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                  <span className="font-mono text-[0.72rem] text-stone-400">index.html</span>
                  <CopyButton
                    value={SNIPPET}
                    label="Copy"
                    variant="ghost"
                    className="text-stone-300 hover:bg-white/10 hover:text-white"
                  />
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-[0.76rem] leading-relaxed text-stone-100">
                  {SNIPPET}
                </pre>
              </div>
            </div>

            <Card className="animate-fade-in p-6 sm:p-7">
              <div className="mb-5">
                <h2 className="text-lg font-semibold tracking-tight">Try it right now</h2>
                <p className="mt-1 text-[0.85rem] leading-relaxed text-muted">
                  This form posts to a live FormFlux endpoint. Same validation, same spam checks — no
                  account needed.
                </p>
              </div>
              <DemoForm />
            </Card>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-[rgb(var(--panel))]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tightest sm:text-[1.85rem]">
                Everything FormSubmit does, plus the parts you wished it had
              </h2>
              <p className="mt-3 leading-relaxed text-muted">
                Same drop-in special fields you already know, with an owner dashboard, real
                analytics, and no cap on browsing your own history.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="rounded-2xl border p-5 transition-colors hover:border-accent-300 dark:hover:border-accent-800"
                  >
                    <div className="grid size-9 place-items-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/50 dark:text-accent-400">
                      <Icon className="size-4" />
                    </div>
                    <h3 className="mt-4 font-semibold tracking-tight">{feature.title}</h3>
                    <p className="mt-2 text-[0.88rem] leading-relaxed text-muted">{feature.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tightest sm:text-[1.85rem]">How it works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  {index < STEPS.length - 1 ? (
                    <span
                      className="hidden h-px flex-1 bg-gradient-to-r from-accent-300 to-transparent sm:block"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <h3 className="mt-4 font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-[0.88rem] leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border bg-gradient-to-br from-accent-50 to-transparent p-8 text-center dark:from-accent-950/30 sm:p-10">
            <h2 className="text-xl font-bold tracking-tightest sm:text-2xl">
              Ship your contact form this afternoon
            </h2>
            <p className="mx-auto mt-2 max-w-lg leading-relaxed text-muted">
              One form and 50 submissions a month are free, forever. Upgrade only when you need
              uploads, webhooks, or analytics.
            </p>
            <Button asChild variant="primary" size="lg" className="mt-6">
              <Link href="/login">
                Create your first form
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
