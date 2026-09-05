import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { ajaxSnippet } from "@/lib/snippet";

export const metadata = {
  title: "Docs",
  description: "Every FormFlux endpoint and special field, with copy-paste examples.",
};

const WORKER = process.env.NEXT_PUBLIC_WORKER_URL || "http://127.0.0.1:8787";

const ZERO_CONFIG = `<form action="${WORKER}/email/you@example.com" method="POST">
  <input type="text" name="name" required />
  <input type="email" name="email" required />
  <textarea name="message" required></textarea>

  <!-- bots fill this in; humans never see it -->
  <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off" />

  <button type="submit">Send</button>
</form>`;

const DASHBOARD_MODE = `<form action="${WORKER}/f/YOUR_FORM_ID"
      method="POST"
      enctype="multipart/form-data">
  <input type="text" name="name" required />
  <input type="email" name="email" required />
  <textarea name="message" required></textarea>
  <input type="file" name="attachment" />

  <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off" />
  <input type="hidden" name="_subject" value="New website enquiry" />
  <input type="hidden" name="_next" value="https://example.com/thanks" />

  <button type="submit">Send</button>
</form>`;

const FIELDS: { name: string; what: string; example: string }[] = [
  {
    name: "_replyto",
    what: "Sets the Reply-To header so replying goes straight to the sender.",
    example: `<input type="hidden" name="_replyto" value="ada@example.com" />`,
  },
  {
    name: "_next",
    what: "Redirects this one submission somewhere else, overriding the form's default redirect.",
    example: `<input type="hidden" name="_next" value="https://example.com/thanks" />`,
  },
  {
    name: "_subject",
    what: "Overrides the notification email's subject line.",
    example: `<input type="hidden" name="_subject" value="New lead from pricing page" />`,
  },
  {
    name: "_cc",
    what: "Comma-separated extra recipients on the notification email.",
    example: `<input type="hidden" name="_cc" value="sales@co.com, ops@co.com" />`,
  },
  {
    name: "_blacklist",
    what: "Comma-separated phrases (20 max). A match silently marks the submission as spam — the sender still sees success.",
    example: `<input type="hidden" name="_blacklist" value="viagra, casino, free money" />`,
  },
  {
    name: "_captcha",
    what: `Set to "false" to skip hCaptcha for this submission, even when the form requires it.`,
    example: `<input type="hidden" name="_captcha" value="false" />`,
  },
  {
    name: "_honey",
    what: "Honeypot. If a bot fills it, the submission is dropped silently. _honeypot works too.",
    example: `<input type="text" name="_honey" style="display:none" />`,
  },
  {
    name: "_autoresponse",
    what: "Custom autoreply body for this submission, overriding the saved template. Supports {{field}} placeholders.",
    example: `<input type="hidden" name="_autoresponse" value="Thanks {{name}}!" />`,
  },
  {
    name: "_template",
    what: `Email layout: "table" (default) or "plain".`,
    example: `<input type="hidden" name="_template" value="plain" />`,
  },
  {
    name: "_webhook",
    what: `Fires an extra webhook to this URL with a { "form_data": {...} } body, alongside your configured destinations.`,
    example: `<input type="hidden" name="_webhook" value="https://example.com/hook" />`,
  },
  {
    name: "_format",
    what: `Set to "json" (or send Accept: application/json) to get a JSON response instead of a redirect.`,
    example: `<input type="hidden" name="_format" value="json" />`,
  },
];

function Snippet({
  title,
  description,
  code,
  language = "html",
}: {
  title: string;
  description: string;
  code: string;
  language?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <CopyButton value={code} label="Copy" toastMessage={`${title} copied`} />
        </div>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto rounded-xl bg-stone-900 p-4 font-mono text-[0.76rem] leading-relaxed text-stone-100">
          <code data-language={language}>{code}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

export default function DocsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-extrabold tracking-tightest sm:text-4xl">Documentation</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          FormFlux accepts standard <code>multipart/form-data</code> and{" "}
          <code>application/x-www-form-urlencoded</code> posts. There is no SDK to install and no key
          to embed in your markup.
        </p>

        <div className="mt-10 space-y-6">
          <Snippet
            title="Zero-config email mode"
            description="Fastest way to start. The first submission emails you a one-time verification link; after you click it, submissions are delivered."
            code={ZERO_CONFIG}
          />

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[0.85rem] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <strong className="font-semibold">Before going live, switch to the UUID endpoint.</strong>{" "}
            The zero-config URL contains your real email address, so scrapers can read it from your
            page source. A dashboard form gives you <code>/f/&lt;uuid&gt;</code> instead, which
            exposes nothing — the same protection as an invisible or aliased address.
          </div>

          <Snippet
            title="Dashboard mode"
            description="Create a form in the dashboard to get a UUID endpoint plus settings for redirects, webhooks, autoreply, captcha, retention, and validation."
            code={DASHBOARD_MODE}
          />

          <Snippet
            title="AJAX / JSON mode"
            description="Send Accept: application/json (or _format=json) and FormFlux replies with JSON instead of redirecting."
            code={ajaxSnippet(`${WORKER}/f/YOUR_FORM_ID`)}
            language="javascript"
          />
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tightest">Special fields</h2>
          <p className="mt-2 leading-relaxed text-muted">
            Hidden inputs that change behaviour for a single submission. They are stripped before the
            submission is stored or emailed.
          </p>

          <div className="mt-6 space-y-3">
            {FIELDS.map((field) => (
              <div key={field.name} className="panel rounded-xl p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-3">
                  <code className="rounded-md bg-accent-50 px-2 py-1 font-mono text-[0.8rem] font-semibold text-accent-700 dark:bg-accent-950/50 dark:text-accent-300">
                    {field.name}
                  </code>
                  <p className="min-w-0 flex-1 text-[0.88rem] leading-relaxed text-soft">
                    {field.what}
                  </p>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-stone-100 p-3 font-mono text-[0.74rem] text-stone-700 dark:bg-stone-800/60 dark:text-stone-300">
                  {field.example}
                </pre>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold tracking-tightest">Limits and behaviour</h2>
          <dl className="mt-6 divide-y">
            {[
              ["File uploads", "10MB total per submission across all files, up to 10 files. Stored in R2 with download links in the email."],
              ["Rate limiting", "Rolling one-hour window per IP and per form, default 100 submissions per hour, configurable per form."],
              ["Spam", "Honeypot drops silently. Blacklist and heuristic matches are stored with is_spam = true and skip email and webhooks. A failed captcha is rejected outright."],
              ["Webhooks", "Delivered in parallel. Non-2xx responses retry with exponential backoff up to five attempts, and every attempt is logged."],
              ["Retention", "A daily job deletes submissions older than each form's retention window, including their uploaded files."],
              ["Archive", "Search your entire submission history from the dashboard with no call limit — it's your own database."],
            ].map(([term, description]) => (
              <div key={term} className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
                <dt className="text-[0.85rem] font-semibold tracking-tight">{term}</dt>
                <dd className="text-[0.88rem] leading-relaxed text-muted">{description}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Button asChild variant="primary">
            <Link href="/login">Create a form</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
