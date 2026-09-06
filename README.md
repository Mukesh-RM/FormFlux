# FormFlux

This is for redeployment purpose again.

A production-ready, self-hostable alternative to FormSubmit.co. Point any HTML `<form>` at a
FormFlux endpoint and get email delivery, spam protection, file uploads, webhooks, autoreply,
retention policies, and an owner dashboard — with no server code in your project.

Everything runs on free tiers by default: Cloudflare Workers, R2, KV, and Queues; Supabase
Postgres and Auth; Resend for email.

```
FormFlux/
├── worker/      Cloudflare Worker API (Hono + TypeScript)
├── dashboard/   Next.js 14 owner dashboard + public marketing site
└── supabase/    schema.sql (fresh install) and migrations/
```

---

## 1. Quick start

### Prerequisites

- Node 18+
- A Supabase project (free tier)
- A Resend account (free tier) — optional until you want real email
- Cloudflare account — only needed to deploy; local dev simulates R2, KV, and Queues

### Database

Run **one** of these in the Supabase SQL editor:

- New project → paste `supabase/schema.sql`
- Existing FormFlux install (phases 1–3) → paste `supabase/migrations/002_dashboard.sql`

Both create the `profiles`, `forms`, `submissions`, and `webhook_logs` tables with row-level
security, a trigger that gives every new auth user a free `profiles` row, and a generated
`submissions.search_text` column that powers dashboard search.

### Worker API

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars   # then fill in your values
npm run dev                      # http://127.0.0.1:8787
```

`http://127.0.0.1:8787/` serves a local demo UI with a live sample form, every special field
documented, and the thank-you / verified / check-inbox / validation-error pages.

### Dashboard

```bash
cd dashboard
npm install
cp .env.example .env.local       # then fill in your values
npm run dev                      # http://localhost:3000
```

In Supabase → Authentication → URL Configuration, add `http://localhost:3000/auth/callback` as a
redirect URL so magic links work locally.

---

## 2. Environment variables

### `worker/.dev.vars` (local) / `wrangler secret put` (production)

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | yes | Service-role key. Server-side only — never ship it to a browser |
| `RESEND_API_KEY` | yes | Resend API key for notification, verification, and autoreply email |
| `RESEND_FROM_EMAIL` | yes | Verified sender, e.g. `FormFlux <forms@yourdomain.com>` |
| `HCAPTCHA_SECRET` | when captcha is on | hCaptcha secret key |
| `PUBLIC_BASE_URL` | recommended | Public origin of the Worker, used to build file download links |
| `DASHBOARD_URL` | recommended | Public origin of the dashboard, used by upgrade prompts |
| `DEFAULT_PLAN` | no | Plan applied to owner-less zero-config forms. `free` by default; set `pro` locally to exercise Pro-only paths |

Bindings live in `worker/wrangler.toml`:

| Binding | Type | Created with |
| --- | --- | --- |
| `RATE_LIMIT_KV` | KV namespace | `npx wrangler kv namespace create RATE_LIMIT_KV` |
| `FORM_UPLOADS` | R2 bucket | `npx wrangler r2 bucket create formflux-uploads` |
| `WEBHOOK_QUEUE` | Queue producer + consumer | `npx wrangler queues create webhook-retries` |
| `triggers.crons` | Cron | `0 3 * * *` — daily retention sweep |

### `dashboard/.env.local`

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key. Safe in the browser; all reads go through RLS |
| `NEXT_PUBLIC_WORKER_URL` | yes | Worker origin, e.g. `http://127.0.0.1:8787` |
| `NEXT_PUBLIC_SITE_URL` | yes | Dashboard origin, used for magic-link redirects |
| `STRIPE_SECRET_KEY` | no | Enables real Pro checkout (stubbed until set) |
| `NEXT_PUBLIC_STRIPE_PRICE_ID` | no | Stripe price for the Pro subscription |

The dashboard never needs `SUPABASE_SERVICE_KEY`. Privileged operations (resending a notification
email, sending a test webhook) go to the Worker with the user's Supabase access token, and the
Worker checks ownership before acting.

---

## 3. Using it

### Zero-config mode

```html
<form action="https://your-worker.workers.dev/email/you@example.com" method="POST">
  <input name="name" required />
  <input type="email" name="email" required />
  <textarea name="message" required></textarea>
  <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off" />
  <button>Send</button>
</form>
```

The first submission emails a one-time verification link. After you click it, submissions are
delivered.

> This URL contains your real email address. Before going live, create a form in the dashboard and
> switch to the UUID endpoint below — nothing in your page source reveals the delivery address,
> which is the same protection FormSubmit's "invisible email" feature provides.

### Dashboard mode

```html
<form action="https://your-worker.workers.dev/f/YOUR_FORM_ID"
      method="POST"
      enctype="multipart/form-data">
  <input name="name" required />
  <input type="email" name="email" required />
  <textarea name="message"></textarea>
  <input type="file" name="attachment" />
  <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off" />
  <button>Send</button>
</form>
```

### AJAX / JSON mode

Send `Accept: application/json` or a `_format=json` field and FormFlux replies with JSON instead of
redirecting:

```js
const response = await fetch(endpoint, {
  method: "POST",
  headers: { Accept: "application/json" },
  body: new FormData(form),
});
// { "success": true, "submissionId": "…" }
```

### Special fields

| Field | What it does |
| --- | --- |
| `_replyto` | Sets the Reply-To header |
| `_next` | Redirect target for this submission only; overrides the form's `redirect_url` |
| `_subject` | Notification email subject |
| `_cc` | Comma-separated extra recipients |
| `_blacklist` | Comma-separated phrases (20 max). A match silently marks the submission as spam |
| `_captcha` | `false` skips hCaptcha for this submission even if the form requires it |
| `_honey` / `_honeypot` | Honeypot; if filled, the submission is dropped silently |
| `_autoresponse` | Autoreply body for this submission, overriding the saved template |
| `_template` | `table` (default) or `plain` / `basic` |
| `_webhook` | Extra one-off webhook URL, posted as `{ "form_data": { … } }` |
| `_format` | `json` for AJAX mode |

Special fields are stripped before the submission is stored or emailed.

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/f/:formId` | Submit to a dashboard form |
| `POST` | `/email/:address` | Zero-config submit |
| `GET` | `/verify/:token` | Confirm an inbox |
| `GET` | `/files/:formId/:submissionId/:filename` | Download an attachment |
| `POST` | `/demo/submit` | Live demo endpoint; runs real checks, stores nothing |
| `POST` | `/api/forms/:id/test-webhook` | Send a sample payload to a destination |
| `POST` | `/api/submissions/:id/resend` | Resend the owner notification (auth required) |
| `POST` | `/api/submissions/:id/spam` | Toggle the spam flag (auth required) |
| `GET` | `/api/me` | Plan, features, and usage for the signed-in owner |

---

## 4. Limits and behaviour

- **File uploads** — 10MB total per submission across all files, 10 files max, stored in R2 at
  `{formId}/{submissionId}/{filename}`.
- **Rate limiting** — rolling one-hour window per IP *and* per form, default 100/hour, set per form.
- **Spam** — honeypot drops silently; blacklist and heuristic matches are stored with
  `is_spam = true` and skip email and webhooks; a failed captcha is rejected outright.
- **Webhooks** — delivered in parallel; non-2xx retries with exponential backoff (60s → 480s) up to
  five attempts via Cloudflare Queues, with every attempt written to `webhook_logs`.
- **Retention** — a daily cron deletes submissions past each form's `retention_days`, including
  their R2 objects. `0` keeps them forever.
- **Plans** — free is 1 form and 50 submissions/month with email only; Pro adds uploads, webhooks,
  autoreply, analytics, custom domain, and removes branding. Gating is enforced in both the Worker
  and the dashboard.

---

## 5. Deploying

### Worker

```bash
cd worker
npx wrangler kv namespace create RATE_LIMIT_KV
npx wrangler r2 bucket create formflux-uploads
npx wrangler queues create webhook-retries
# put the returned KV ids into wrangler.toml

npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put HCAPTCHA_SECRET

npx wrangler deploy
```

Set `PUBLIC_BASE_URL` and `DASHBOARD_URL` in `wrangler.toml` to your deployed origins.

### Dashboard (Cloudflare Pages)

```bash
cd dashboard
npm run build
```

Then either connect the repo in the Cloudflare Pages dashboard (build command `npm run build`,
output `.next`, framework preset **Next.js**) or deploy with `@cloudflare/next-on-pages`. Add the
`NEXT_PUBLIC_*` variables in the Pages project settings, and add
`https://your-dashboard-domain/auth/callback` to Supabase's allowed redirect URLs.

### Before real public traffic

- Verify your sending domain in Resend and update `RESEND_FROM_EMAIL` (unverified senders are
  limited to your own address).
- Point DNS at the Worker and the Pages project, and set `PUBLIC_BASE_URL` / `DASHBOARD_URL`.
- Create the KV namespace, R2 bucket, and Queue in the production account.
- Add real hCaptcha keys if you enable captcha.
- Add Stripe keys and finish `dashboard/src/app/api/checkout/route.ts` if you want paid upgrades.

---

## 6. Development

```bash
# worker
cd worker && npm run dev
node node_modules/typescript/bin/tsc --noEmit

# dashboard
cd dashboard && npm run dev
npm run typecheck && npm run build
```
