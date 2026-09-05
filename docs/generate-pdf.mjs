/**
 * Generates docs/FormFlux-Engineering-Document.pdf
 *
 * Everything is drawn with pdfkit's built-in fonts and vector primitives so the
 * document (including the flowchart on the final page) builds with no system
 * dependencies beyond Node.
 *
 *   cd docs && npm install && npm run build
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "FormFlux-Engineering-Document.pdf");

/* ------------------------------------------------------------------ theme */

const ACCENT = "#e2450c";
const ACCENT_SOFT = "#fff5ed";
const INK = "#1c1917";
const INK_SOFT = "#44403c";
const MUTED = "#78716c";
const LINE = "#e7e5e4";
const CODE_BG = "#f5f5f4";

const MARGIN = 58;
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;

const doc = new PDFDocument({
  size: "A4",
  margins: { top: MARGIN, bottom: MARGIN + 24, left: MARGIN, right: MARGIN },
  bufferPages: true,
  info: {
    Title: "FormFlux — Engineering & Workflow Document",
    Author: "FormFlux",
    Subject: "Architecture, build log, and end-to-end workflow of the FormFlux form backend",
  },
});

doc.pipe(fs.createWriteStream(OUT));

let sectionNumber = 0;
const toc = [];
let suppressFooter = true; // cover page has no footer

/* --------------------------------------------------------------- helpers */

function ensureSpace(height) {
  if (doc.y + height > PAGE_H - MARGIN - 28) {
    doc.addPage();
  }
  // Helpers that draw at explicit x coordinates leave doc.x shifted; reset it so
  // the next flowed paragraph starts at the margin.
  doc.x = MARGIN;
}

function h1(text) {
  sectionNumber += 1;
  doc.addPage();
  doc.x = MARGIN;

  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(9);
  doc.text(`SECTION ${String(sectionNumber).padStart(2, "0")}`, { characterSpacing: 1.4 });
  doc.moveDown(0.35);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(21);
  doc.text(text, { lineGap: 2 });
  doc.moveDown(0.15);

  const y = doc.y + 4;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + 46, y).lineWidth(2.5).strokeColor(ACCENT).stroke();
  doc.y = y + 14;
}

function h2(text) {
  ensureSpace(60);
  doc.moveDown(0.5);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(12.5);
  doc.text(text);
  doc.moveDown(0.3);
}

function h3(text) {
  ensureSpace(46);
  doc.moveDown(0.35);
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(9.5);
  doc.text(text.toUpperCase(), { characterSpacing: 0.7 });
  doc.moveDown(0.25);
}

function p(text, options = {}) {
  ensureSpace(40);
  doc.fillColor(options.color || INK_SOFT).font("Helvetica").fontSize(9.6);
  doc.text(text, { align: "left", lineGap: 3.2, ...options });
  doc.moveDown(0.45);
}

function bullets(items, { numbered = false } = {}) {
  doc.fontSize(9.6).font("Helvetica");
  items.forEach((item, index) => {
    ensureSpace(34);
    const marker = numbered ? `${index + 1}.` : "•";
    const markerW = numbered ? 16 : 12;
    const y = doc.y;

    doc.fillColor(numbered ? ACCENT : MUTED).font(numbered ? "Helvetica-Bold" : "Helvetica");
    doc.text(marker, MARGIN + 2, y, { width: markerW, continued: false });

    doc.fillColor(INK_SOFT).font("Helvetica");
    doc.text(item, MARGIN + 2 + markerW, y, {
      width: CONTENT_W - markerW - 2,
      lineGap: 3,
    });
    doc.moveDown(0.28);
  });
  doc.moveDown(0.3);
  doc.x = MARGIN;
}

function code(lines, { caption } = {}) {
  const text = Array.isArray(lines) ? lines.join("\n") : lines;
  doc.font("Courier").fontSize(8.2);
  const textH = doc.heightOfString(text, { width: CONTENT_W - 24, lineGap: 2 });
  const boxH = textH + 20;

  ensureSpace(boxH + (caption ? 16 : 0) + 12);

  if (caption) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
    doc.text(caption.toUpperCase(), { characterSpacing: 0.6 });
    doc.moveDown(0.2);
  }

  const top = doc.y;
  doc.roundedRect(MARGIN, top, CONTENT_W, boxH, 5).fillColor(CODE_BG).fill();
  doc.rect(MARGIN, top, 2.5, boxH).fillColor(ACCENT).fill();

  doc.fillColor("#292524").font("Courier").fontSize(8.2);
  doc.text(text, MARGIN + 14, top + 10, { width: CONTENT_W - 26, lineGap: 2 });

  doc.y = top + boxH + 10;
  doc.x = MARGIN;
}

/** Two-column reference table with zebra rows and wrapped cells. */
function table(rows, { head, widths = [0.32, 0.68] } = {}) {
  const colW = widths.map((w) => w * CONTENT_W);

  function drawRow(cells, { isHead = false, zebra = false } = {}) {
    doc.font(isHead ? "Helvetica-Bold" : "Helvetica").fontSize(isHead ? 8.4 : 9);

    const heights = cells.map((cell, index) =>
      doc.heightOfString(String(cell), { width: colW[index] - 16, lineGap: 2.4 }),
    );
    const rowH = Math.max(...heights) + 13;

    if (doc.y + rowH > PAGE_H - MARGIN - 28) {
      doc.addPage();
      if (head) drawRow(head, { isHead: true });
    }

    const top = doc.y;
    if (isHead) {
      doc.rect(MARGIN, top, CONTENT_W, rowH).fillColor("#1c1917").fill();
    } else if (zebra) {
      doc.rect(MARGIN, top, CONTENT_W, rowH).fillColor("#faf9f8").fill();
    }

    let x = MARGIN;
    cells.forEach((cell, index) => {
      const isFirst = index === 0;
      doc
        .fillColor(isHead ? "#ffffff" : isFirst ? INK : INK_SOFT)
        .font(isHead ? "Helvetica-Bold" : isFirst ? "Courier-Bold" : "Helvetica")
        .fontSize(isHead ? 8.4 : isFirst ? 8.4 : 9);
      doc.text(String(cell), x + 8, top + 6.5, { width: colW[index] - 16, lineGap: 2.4 });
      x += colW[index];
    });

    doc.y = top + rowH;
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(MARGIN + CONTENT_W, doc.y)
      .lineWidth(0.5)
      .strokeColor(LINE)
      .stroke();
    doc.x = MARGIN;
  }

  ensureSpace(70);
  if (head) drawRow(head, { isHead: true });
  rows.forEach((row, index) => drawRow(row, { zebra: index % 2 === 1 }));
  doc.moveDown(0.6);
}

function callout(title, body, { tone = "accent" } = {}) {
  const palette = {
    accent: { bg: ACCENT_SOFT, border: "#fecdaa", text: "#952a12" },
    warn: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
    note: { bg: "#f5f5f4", border: LINE, text: INK_SOFT },
  }[tone];

  doc.font("Helvetica").fontSize(9.2);
  const bodyH = doc.heightOfString(body, { width: CONTENT_W - 28, lineGap: 3 });
  const boxH = bodyH + 34;

  ensureSpace(boxH + 12);
  const top = doc.y;

  doc.roundedRect(MARGIN, top, CONTENT_W, boxH, 6).fillColor(palette.bg).fill();
  doc
    .roundedRect(MARGIN, top, CONTENT_W, boxH, 6)
    .lineWidth(0.8)
    .strokeColor(palette.border)
    .stroke();

  doc.fillColor(palette.text).font("Helvetica-Bold").fontSize(9);
  doc.text(title, MARGIN + 14, top + 11, { width: CONTENT_W - 28 });
  doc.fillColor(palette.text).font("Helvetica").fontSize(9.2);
  doc.text(body, MARGIN + 14, doc.y + 2, { width: CONTENT_W - 28, lineGap: 3 });

  doc.y = top + boxH + 12;
  doc.x = MARGIN;
}

/* ------------------------------------------------------------ cover page */

doc.rect(0, 0, PAGE_W, PAGE_H).fillColor("#ffffff").fill();
doc.rect(0, 0, PAGE_W, 240).fillColor("#1c1917").fill();
doc.rect(0, 236, PAGE_W, 4).fillColor(ACCENT).fill();

// decorative marks
doc.circle(PAGE_W - 70, 60, 44).lineWidth(1).strokeColor("#3f3a37").stroke();
doc.circle(PAGE_W - 70, 60, 26).fillColor(ACCENT).fillOpacity(0.18).fill();
doc.fillOpacity(1);

doc.fillColor("#a8a29e").font("Helvetica-Bold").fontSize(9);
doc.text("ENGINEERING & WORKFLOW DOCUMENT", MARGIN, 74, { characterSpacing: 1.8 });

doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(40);
doc.text("Form", MARGIN, 104, { continued: true });
doc.fillColor(ACCENT).text("Flux");

doc.fillColor("#d6d3d1").font("Helvetica").fontSize(11.5);
doc.text(
  "A self-hostable, production-ready alternative to FormSubmit.co.\nEmail delivery, spam protection, file uploads, webhooks and an\nowner dashboard for any plain HTML form.",
  MARGIN,
  164,
  { width: CONTENT_W - 110, lineGap: 3.5 },
);

doc.y = 290;
doc.x = MARGIN;

doc.fillColor(INK).font("Helvetica-Bold").fontSize(13);
doc.text("What this document covers");
doc.moveDown(0.4);
doc.fillColor(INK_SOFT).font("Helvetica").fontSize(10);
doc.text(
  "The complete architecture of the FormFlux engine, the request-by-request workflow of a form submission, every special field and how it changes behaviour, the data model, the owner dashboard, the plan gating model, the full build log of what was created across five phases, deployment steps, and a workflow flowchart on the final page.",
  { width: CONTENT_W, lineGap: 3.6 },
);

doc.moveDown(1.4);

const stackTop = doc.y;
const stack = [
  ["API runtime", "Cloudflare Workers + Hono (TypeScript)"],
  ["Database", "Supabase Postgres with Row Level Security"],
  ["Auth", "Supabase Auth (magic link)"],
  ["Email", "Resend"],
  ["File storage", "Cloudflare R2"],
  ["Rate limiting", "Cloudflare KV"],
  ["Retries", "Cloudflare Queues"],
  ["Dashboard", "Next.js 14 App Router + Tailwind CSS"],
];

doc.roundedRect(MARGIN, stackTop, CONTENT_W, stack.length * 22 + 20, 8).fillColor("#faf9f8").fill();
doc
  .roundedRect(MARGIN, stackTop, CONTENT_W, stack.length * 22 + 20, 8)
  .lineWidth(0.8)
  .strokeColor(LINE)
  .stroke();

stack.forEach(([label, value], index) => {
  const y = stackTop + 12 + index * 22;
  doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8.6);
  doc.text(label.toUpperCase(), MARGIN + 16, y + 3, { width: 120, characterSpacing: 0.5 });
  doc.fillColor(INK).font("Helvetica").fontSize(9.6);
  doc.text(value, MARGIN + 148, y, { width: CONTENT_W - 164 });
});

doc.y = stackTop + stack.length * 22 + 44;
doc.x = MARGIN;
doc.fillColor(MUTED).font("Helvetica").fontSize(9);
doc.text(
  `Generated ${new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}  ·  Repository: FormFlux  ·  Status: builds green, ready for deployment configuration`,
  MARGIN,
  PAGE_H - MARGIN - 30,
  { width: CONTENT_W },
);

suppressFooter = false;

/* ------------------------------------------------- 1. Executive summary */

h1("Executive summary");

p(
  "FormFlux replaces the small backend everyone writes for contact forms. A developer points a plain HTML form at a FormFlux URL and immediately gets email delivery, spam filtering, validation, file attachments, webhook fan-out, an autoreply, and a dashboard to browse everything — without writing or hosting server code.",
);

p(
  "It is a feature-complete replica of FormSubmit.co: every documented special field behaves identically, so snippets copied from FormSubmit's documentation work unchanged. On top of that parity, FormFlux adds an owner dashboard, real analytics, per-form configuration, and an unlimited submission archive.",
);

h2("Design goals");
bullets([
  "Zero-config first run: a developer should get a working form before creating an account.",
  "Nothing paid required: the entire stack runs on free tiers (Cloudflare, Supabase, Resend).",
  "Never lose a submission: spam is flagged and stored, never silently discarded, so false positives can be recovered.",
  "No secrets in page source: UUID endpoints mean the delivery address never appears in HTML.",
  "Owner control: retention windows, rate limits, validation rules, and blocklists are all per-form settings.",
]);

h2("What exists today");
table(
  [
    ["worker/", "The API. Hono app on Cloudflare Workers handling submissions, verification, file downloads, webhooks, retries, the daily retention cron, and authenticated dashboard endpoints."],
    ["dashboard/", "Next.js 14 app serving both the public marketing site (landing, docs, pricing) and the authenticated owner dashboard (forms, settings, submissions, webhooks, analytics, archive)."],
    ["supabase/", "schema.sql for a fresh install plus migrations/002_dashboard.sql for existing installs. Four tables, all under Row Level Security."],
    ["docs/", "This document and the pdfkit script that generates it."],
  ],
  { head: ["Directory", "Responsibility"], widths: [0.22, 0.78] },
);

callout(
  "One-line summary",
  "FormFlux is a Cloudflare Worker that turns an HTTP form POST into an email, a database row, a set of webhook deliveries, and an autoreply — plus a Next.js dashboard that lets the form's owner configure and inspect all of it.",
);

/* --------------------------------------------------- 2. System overview */

h1("System architecture");

p(
  "FormFlux is two deployable units that share one Supabase project. They never share a secret: the Worker holds the service-role key, the dashboard only ever uses the anon key and relies on Row Level Security.",
);

h2("The two units");
h3("Worker (the engine)");
bullets([
  "Runs at the edge on Cloudflare Workers, so submissions are handled close to the sender with no cold-start server to keep warm.",
  "Holds SUPABASE_SERVICE_KEY, RESEND_API_KEY, and HCAPTCHA_SECRET as Worker secrets. Because service-role queries bypass RLS, every authenticated route re-checks ownership explicitly.",
  "Bindings: RATE_LIMIT_KV (rate limit counters), FORM_UPLOADS (R2 bucket for attachments), WEBHOOK_QUEUE (retry queue), and a cron trigger at 03:00 UTC for the retention sweep.",
]);

h3("Dashboard (the control surface)");
bullets([
  "Next.js 14 App Router. Server Components read Supabase through the request's cookies, so every query is filtered by RLS to the signed-in owner's rows.",
  "Server Actions handle writes (create form, save settings, delete, toggle spam flag). Client components handle interactive tables, charts, and forms.",
  "Two privileged operations — resending a notification email and sending a test webhook — are delegated to the Worker with the user's Supabase access token, because they need the Resend key.",
]);

h2("Trust boundaries");
table(
  [
    ["Browser → Worker", "Public. Anyone may POST a submission. Protection comes from the honeypot, captcha, rate limits, blocklists, and validation rules — not from authentication."],
    ["Browser → Supabase", "Anon key only. Row Level Security restricts every read and write to rows owned by the authenticated user."],
    ["Dashboard → Worker", "Supabase access token in an Authorization: Bearer header. The Worker verifies the token, then checks that the user owns the target form."],
    ["Worker → Supabase", "Service-role key. Full access, so ownership checks are performed in application code."],
  ],
  { head: ["Boundary", "How it is controlled"], widths: [0.26, 0.74] },
);

/* ------------------------------------------------------- 3. Data model */

h1("Data model");

p(
  "Four tables, all with Row Level Security enabled. A trigger on auth.users creates a free profiles row for every new signup, so the dashboard never has to handle a missing profile.",
);

h2("profiles");
p("One row per authenticated user. Holds the plan flag that drives all feature gating.");
code([
  "id          uuid  primary key, references auth.users",
  "email       text",
  "plan        text  'free' | 'pro'   (default 'free')",
  "created_at  timestamptz",
]);

h2("forms");
p(
  "One row per endpoint. Every dashboard setting is a column here, which is why the owner never has to hand-edit hidden inputs unless they want a one-off override.",
);
code([
  "id                   uuid  primary key         -- this is the /f/:formId in the endpoint",
  "owner_id             uuid  -> profiles(id)     -- null for unclaimed zero-config forms",
  "name                 text",
  "target_email         text",
  "is_verified          boolean                   -- gates delivery",
  "verification_token   text",
  "redirect_url         text                      -- default redirect, overridden by _next",
  "default_subject      text                      -- overridden by _subject",
  "default_cc           text                      -- overridden by _cc",
  "webhook_urls         text[]                    -- generic JSON destinations",
  "slack_webhook_url    text",
  "discord_webhook_url  text",
  "captcha_enabled      boolean                   -- overridden by _captcha=false",
  "blacklist_phrases    text[]                    -- merged with per-submission _blacklist",
  "autoreply_enabled    boolean",
  "autoreply_template   text                      -- overridden by _autoresponse",
  "validation_rules     jsonb                     -- { field: { required, regex } }",
  "retention_days       int                       -- 0 keeps forever",
  "rate_limit_per_hour  int                       -- default 100",
]);

h2("submissions");
p(
  "One row per accepted submission, including spam. The meta column is the audit trail the dashboard drawer reads to show which special fields were used and whether captcha ran.",
);
code([
  "id           uuid  primary key",
  "form_id      uuid  -> forms(id) on delete cascade",
  "data         jsonb            -- submitted fields, special fields stripped",
  "files        text[]           -- R2 object keys",
  "ip_address   text",
  "is_spam      boolean          -- true = stored but not emailed or webhooked",
  "delivered    boolean          -- owner notification actually sent",
  "meta         jsonb            -- specialFields[], captcha, spamReasons[], redirect, plan",
  "search_text  text  GENERATED ALWAYS AS (data::text) STORED",
  "created_at   timestamptz",
]);

callout(
  "Why search_text exists",
  "PostgREST cannot ILIKE across an entire jsonb document, and enumerating field names would miss custom fields. A stored generated column holding the payload as text lets one ILIKE search every field of every submission, with a pg_trgm GIN index to keep it fast.",
  { tone: "note" },
);

h2("webhook_logs");
p(
  "One row per delivery attempt, including retries and manual tests. form_id is present so test deliveries (which have no submission) are still visible and still covered by RLS.",
);
code([
  "id                uuid  primary key",
  "submission_id     uuid  -> submissions(id)   -- null for test deliveries",
  "form_id           uuid  -> forms(id)",
  "destination       text",
  "status_code       int                        -- 0 when the request never completed",
  "attempt           int                        -- 1..5",
  "response_snippet  text                       -- first 300 chars of the response",
  "source            text                       -- generic | slack | discord | formsubmit | test",
  "created_at        timestamptz",
]);

h2("Row Level Security summary");
table(
  [
    ["profiles", "Select, insert, and update only where auth.uid() = id."],
    ["forms", "All operations where auth.uid() = owner_id."],
    ["submissions", "Select, update, and delete where the parent form is owned by auth.uid(). Inserts come from the Worker's service-role client."],
    ["webhook_logs", "Select where the form or the parent submission's form is owned by auth.uid()."],
  ],
  { head: ["Table", "Policy"], widths: [0.24, 0.76] },
);

/* ------------------------------------------ 4. Submission workflow */

h1("The submission pipeline");

p(
  "This is the core of the engine: what happens between a visitor pressing Send and the owner's inbox. Order matters — cheap rejections happen before expensive work, and nothing is written to storage until the submission has passed every gate.",
);

h2("Step by step");
bullets(
  [
    "Route match. POST /f/:formId loads the form by UUID. POST /email/:address is the zero-config path: it finds or creates a form for that address and, on first contact, emails a verification link and stops.",
    "Body parse. form-body.ts reads multipart/form-data or x-www-form-urlencoded into a flat field map plus a list of File objects. Repeated field names are joined with commas so checkbox groups survive.",
    "Special field parse. special-fields.ts extracts _next, _blacklist, _captcha, _webhook, _autoresponse, _subject, _cc, _replyto, _template, _format, and the honeypot, and records which of them were present for the audit trail.",
    "Honeypot. If _honey or _honeypot has any value, the submission is dropped and the sender receives a completely normal success response. Bots get no signal.",
    "Plan resolution. The owner's plan is loaded from profiles. Unclaimed zero-config forms fall back to DEFAULT_PLAN, which is free unless overridden for local testing.",
    "Upload gate. Attachments on a free-plan form return a friendly upgrade message. Otherwise the total size of all files is checked against the 10MB cap before any R2 write is attempted.",
    "Validation rules. Each configured field is checked for required and against its regex. Failures return a 400 with a structured error list, or an HTML error page for browser posts.",
    "Captcha. If the form requires hCaptcha and the submission did not send _captcha=false, the token is verified server-side against hcaptcha.com/siteverify. A failure is rejected outright — this is the one spam signal that does not get stored.",
    "Rate limit. A rolling one-hour counter in KV is incremented per form and per IP. Exceeding the form's limit returns 429 with a Retry-After header.",
    "Monthly quota. Free plans are capped at 50 submissions per calendar month across all their forms; exceeding it returns a clear upgrade message rather than a silent drop.",
    "Spam scoring. Per-submission _blacklist phrases are merged with the form's saved list, capped at 20 total, and matched case-insensitively against the visible field text. Link-count and keyword heuristics also run. Any hit sets is_spam.",
    "File storage. Files are written to R2 at {formId}/{submissionId}/{filename} with sanitised, de-duplicated names.",
    "Database insert. The submission is stored with its payload, file keys, spam flag, and meta audit trail. If the insert fails, the R2 objects just written are deleted so nothing is orphaned.",
    "Owner notification. Unless the submission is spam, Resend sends the notification with the resolved subject, CC list, Reply-To, and template, including download links for any attachments.",
    "Autoreply. If enabled, the submitter's address is detected from email, e-mail, or _replyto and a templated confirmation is sent. _autoresponse overrides the saved template for this submission.",
    "Webhook fan-out. All configured destinations plus any one-off _webhook fire in parallel. Every attempt is logged; failures are queued for retry.",
    "Response. JSON when _format=json or Accept: application/json was sent; otherwise a 302 to _next, then the form's redirect_url, then a built-in thank-you page.",
  ],
  { numbered: true },
);

callout(
  "The ordering rule",
  "Rejections that cost nothing (honeypot, plan gate, validation) come before rejections that cost a network call (captcha) which come before anything that costs storage (R2, Postgres) which comes before anything that costs a third party (Resend, webhooks).",
);

h2("Response shapes");
table(
  [
    ["200 HTML", "Thank-you page. Free plans get a small 'Powered by FormFlux' line; Pro does not."],
    ["302", "Redirect to _next, else the form's redirect_url. Only http and https targets are honoured."],
    ["200 JSON", '{ "success": true, "submissionId": "..." } — AJAX mode.'],
    ["400", "Validation errors as a field/message list, a captcha failure, or an oversized upload."],
    ["403", "The target inbox has not been verified yet, so delivery is withheld."],
    ["429", "Rate limit exceeded (with Retry-After) or the free monthly quota is used up."],
  ],
  { head: ["Status", "Meaning"], widths: [0.18, 0.82] },
);

/* ------------------------------------------------- 5. Special fields */

h1("Special fields reference");

p(
  "Hidden inputs that change behaviour for a single submission. All of them are stripped from the payload before it is stored or emailed, so they never leak into the owner's inbox or the dashboard table. Every field below matches FormSubmit.co's documented behaviour.",
);

table(
  [
    ["_replyto", "Sets the Reply-To header. When absent, FormFlux auto-detects the submitter's address from an email or e-mail field, so replying always reaches the sender."],
    ["_next", "Redirect target for this submission only, overriding the form's saved redirect_url. Non-http(s) values are ignored and logged rather than followed."],
    ["_subject", "Notification email subject, overriding the form's default_subject."],
    ["_cc", "Comma-separated additional recipients, overriding default_cc."],
    ["_blacklist", "Comma-separated phrases. A case-insensitive match anywhere in the submitted text silently marks the submission as spam. Capped at 20 phrases."],
    ["_captcha", 'The literal string "false" skips hCaptcha for this submission even when the form requires it.'],
    ["_honey", "Honeypot. Any value means a bot filled a hidden field, so the submission is dropped silently. _honeypot is accepted as an alias."],
    ["_autoresponse", "Autoreply body for this submission, overriding the saved template. Supports {{field}} placeholders."],
    ["_template", 'Email layout: "table" (default) or "plain". "basic" and "text" are accepted as aliases of plain for FormSubmit compatibility.'],
    ["_webhook", 'Extra one-off webhook destination, posted with FormSubmit\'s exact { "form_data": { ... } } body so copied examples work unchanged.'],
    ["_format", 'Set to "json" for an AJAX-style JSON response instead of a redirect.'],
  ],
  { head: ["Field", "Behaviour"], widths: [0.2, 0.8] },
);

h2("Override precedence");
p(
  "For every setting that exists in both places, the per-submission hidden input wins over the stored form setting. This is deliberate: the dashboard holds the sensible default, and a single page can deviate without a configuration change.",
);
code([
  "subject   :  _subject       ->  forms.default_subject   ->  'New FormFlux submission'",
  "cc        :  _cc            ->  forms.default_cc        ->  none",
  "reply-to  :  _replyto       ->  detected email field    ->  none",
  "redirect  :  _next          ->  forms.redirect_url      ->  built-in thank-you page",
  "autoreply :  _autoresponse  ->  forms.autoreply_template",
  "captcha   :  _captcha=false ->  forms.captcha_enabled",
  "blacklist :  _blacklist  +  forms.blacklist_phrases     (merged, capped at 20)",
]);

callout(
  "Why the blacklist is capped at 20",
  "Matching every phrase against every field is O(phrases x fields). Twenty is far more than any hand-written blocklist needs, and the cap stops a hostile submission from turning one request into thousands of substring scans.",
  { tone: "warn" },
);

/* ------------------------------------------ 6. Spam, limits, delivery */

h1("Spam protection, limits, and delivery");

h2("Four layers of spam defence");
table(
  [
    ["Honeypot", "A hidden field bots fill and humans never see. Filled means dropped silently, with a normal success response so the bot learns nothing."],
    ["hCaptcha", "Optional per form. Verified server-side. A failed token is the only spam signal that is rejected outright rather than stored."],
    ["Blocklist", "Per-form phrases plus per-submission _blacklist. Matches are stored with is_spam = true and skip email and webhooks."],
    ["Heuristics", "Excessive link counts and known spam keywords across the visible field text. Same soft outcome as the blocklist."],
  ],
  { head: ["Layer", "Behaviour"], widths: [0.2, 0.8] },
);

callout(
  "Soft spam handling is a feature, not a shortcut",
  "Everything except a failed captcha is stored rather than discarded. The owner sees flagged submissions in the dashboard, can read exactly which rule fired from the meta.spamReasons list, and can mark a false positive as legitimate and resend the notification email.",
);

h2("Rate limiting");
p(
  "A rolling one-hour window in Cloudflare KV, counted independently per form and per IP. The limit is the form's rate_limit_per_hour, default 100. Exceeding it returns 429 with a Retry-After header telling the client exactly how long to wait.",
);

h2("File uploads");
bullets([
  "10MB across all files in one submission — a total cap, not per file, matching FormSubmit.",
  "Maximum 10 files per submission.",
  "Filenames are sanitised to a safe character set and de-duplicated with a short suffix when they collide.",
  "Stored in R2 under {formId}/{submissionId}/{filename} and served back through GET /files/... with a Content-Disposition attachment header.",
  "Download links appear in the notification email, the webhook payload, the submission drawer, and the archive view.",
]);

h2("Webhooks");
p(
  "All destinations fire in parallel on every accepted submission. Each format has its own payload shape so the receiving system needs no adapter.",
);
table(
  [
    ["generic", "FormFlux JSON: event, formId, formName, submissionId, createdAt, data, and files with signed-style download URLs."],
    ["slack", "Slack Block Kit: a header, a submission reference, field sections, and a files section with links."],
    ["discord", "A rich embed with the form name as the title and each field as an inline embed field."],
    ["formsubmit", 'FormSubmit-compatible { "form_data": { ... } }, used for the per-submission _webhook field.'],
  ],
  { head: ["Kind", "Payload"], widths: [0.2, 0.8] },
);

h3("Retry behaviour");
p(
  "A non-2xx response or a network failure enqueues a retry on Cloudflare Queues with exponential backoff — 60s, 120s, 240s, then 480s — for up to five total attempts. Every attempt writes a webhook_logs row with its status code, attempt number, and a 300-character response snippet, which is exactly what the dashboard's delivery log renders.",
);

h2("Autoreply and retention");
bullets([
  "Autoreply detects the submitter from email, e-mail, or _replyto and renders {{field}} placeholders from the submitted data. The dashboard shows a live preview of the rendered template.",
  "A cron trigger at 03:00 UTC deletes submissions older than each form's retention_days, including their R2 objects. Setting 0 keeps submissions forever.",
]);

/* --------------------------------------------------- 7. The dashboard */

h1("The owner dashboard");

p(
  "A Next.js 14 App Router application that serves both the public marketing pages and the authenticated dashboard, sharing one design system: a warm terracotta accent reserved strictly for primary actions, stone neutrals, and a dark mode toggle in the header.",
);

h2("Routes");
table(
  [
    ["/", "Landing page. Hero, a working demo form that posts to the Worker's live demo endpoint, a feature grid, a three-step how-it-works, and a footer."],
    ["/docs", "Copy-paste snippets for zero-config, dashboard, and AJAX modes, plus a reference entry for every special field."],
    ["/pricing", "Free versus Pro comparison with a Stripe Checkout stub behind the upgrade button."],
    ["/login", "Supabase magic-link sign-in on a centred card, with inline email validation."],
    ["/forms", "Grid of the owner's forms: verification badge, this month's submission count, spam count, and a copy-endpoint button. New accounts get a guided empty state."],
    ["/forms/[id]", "Tabbed detail view: Submissions, Settings, Webhooks, Analytics."],
    ["/archive", "Search across the owner's entire submission history, with a per-form filter and attachment links. No call limit."],
    ["/settings", "Plan, usage against the current limits, and an explanation of how UUID endpoints keep the delivery address out of page source."],
  ],
  { head: ["Route", "Purpose"], widths: [0.22, 0.78] },
);

h2("The four tabs");
h3("Submissions");
bullets([
  "Paginated, searchable, and filterable by all / not spam / spam.",
  "Row click opens a detail drawer with the full payload, attachment downloads, captcha outcome, which special fields the submission used, and the exact spam reasons if it was flagged.",
  "Mark a false positive as not spam, resend the owner notification, delete a submission, or export the whole history as CSV.",
  "Becomes a card layout on mobile instead of scrolling horizontally.",
]);

h3("Settings");
bullets([
  "Every form column is editable here: target email, redirect, default subject and CC, webhook destinations, Slack and Discord URLs, captcha, blocklist phrases with a live count, autoreply with a live preview, validation rules, retention, and rate limit.",
  "The validation rule builder includes a per-rule 'test a sample value' tool that shows pass or fail as you type.",
  "A read-only 'copy this HTML' panel stays in sync with the current settings, so the snippet always matches the saved configuration.",
  "A sticky save bar reports unsaved changes, and navigating away with unsaved edits triggers a browser warning.",
]);

h3("Webhooks");
p(
  "Lists form-level destinations plus any per-submission _webhook URLs seen historically, each with a 'send test payload' button and immediate toast feedback, above a delivery log showing status code, attempt number, response snippet, and timestamp.",
);

h3("Analytics");
p(
  "A 30-day submissions-per-day area chart in the accent colour with spam overlaid as a dashed line, plus spam-blocked count, webhook delivery success rate, and captcha pass rate.",
);

h2("Interaction standards applied throughout");
bullets([
  "Every destructive action goes through a confirmation dialog.",
  "Every table shows loading skeletons rather than a blank flash.",
  "Every settings field validates inline with a red border and a message under the field.",
  "Every action reports through a toast — no browser alert() anywhere.",
  "Empty states always explain the next step instead of showing an empty table.",
]);

/* --------------------------------------------------- 8. Plans/gating */

h1("Plans and feature gating");

p(
  "Gating is enforced in both the Worker and the dashboard from the same source of truth: profiles.plan. The dashboard shows a friendly upgrade prompt instead of hiding a feature, and the Worker returns an explicit upgradeRequired response rather than silently ignoring the request.",
);

table(
  [
    ["Forms", "1", "Unlimited"],
    ["Submissions / month", "50", "Unlimited"],
    ["Email delivery", "Yes", "Yes"],
    ["Spam protection & captcha", "Yes", "Yes"],
    ["All special fields", "Yes", "Yes"],
    ["Archive & CSV export", "Yes", "Yes"],
    ["File uploads", "No", "Yes"],
    ["Webhooks / Slack / Discord", "No", "Yes"],
    ["Autoreply", "No", "Yes"],
    ["Analytics", "No", "Yes"],
    ["Custom domain", "No", "Yes"],
    ["FormFlux branding", "Shown", "Removed"],
  ],
  { head: ["Capability", "Free", "Pro ($7/mo)"], widths: [0.5, 0.25, 0.25] },
);

callout(
  "Deliberate difference from FormSubmit",
  "FormSubmit limits reading your own submission archive to five API calls per day. FormFlux has no such limit on any plan, because the data lives in the owner's own Supabase project and is read directly under Row Level Security.",
);

/* ----------------------------------------------------- 9. Build log */

h1("Build log — what was created");

p(
  "The project was built in five phases. Each phase extended the previous one rather than replacing it.",
);

h2("Phase 1 — Core submission engine");
bullets([
  "Supabase schema with profiles, forms, and submissions under RLS.",
  "Hono app on Cloudflare Workers with POST /f/:formId and POST /email/:address.",
  "Multipart and urlencoded body parsing, honeypot, validation rules.",
  "Resend notification email with _subject, _cc, _replyto, and _template support.",
  "Inbox verification flow at GET /verify/:token, JSON versus redirect response handling.",
]);

h2("Phase 2 — Spam protection and rate limiting");
bullets([
  "Server-side hCaptcha verification gated on the form's captcha_enabled flag.",
  "Rolling one-hour KV rate limiting per IP and per form, returning 429 with Retry-After.",
  "Heuristic spam detection storing matches with is_spam = true instead of discarding them.",
]);

h2("Phase 3 — Files, webhooks, autoreply, retention");
bullets([
  "R2 uploads with sanitised keys and a GET /files/... download route.",
  "Webhook fan-out in generic, Slack, and Discord formats, logged to a new webhook_logs table.",
  "Cloudflare Queues retry with exponential backoff up to five attempts, plus a manual test-webhook endpoint.",
  "Autoreply with {{field}} placeholders and a daily retention cron that also deletes R2 objects.",
  "A local demo UI at the Worker root for inspecting every page state in a browser.",
]);

h2("Phase 4 — Full FormSubmit parity");
bullets([
  "New special-fields module implementing _next, _blacklist, _captcha, _webhook, and _autoresponse, plus _honey as a honeypot alias.",
  "10MB total upload cap across all files in a submission, enforced before any R2 write.",
  "Reply-To auto-detection and _template=basic accepted for FormSubmit compatibility.",
  "Plan gating in the Worker, a submission meta audit trail, and authenticated dashboard endpoints (/api/me, resend, spam toggle).",
  "Migration 002 adding default_subject, default_cc, blacklist_phrases, submissions.meta, the generated search_text column, webhook_logs.form_id and response_snippet, and the new-user profile trigger.",
]);

h2("Phase 5 — Dashboard and public site");
bullets([
  "Next.js 14 dashboard with Tailwind, Radix-based shadcn-style primitives, dark mode, and toast feedback.",
  "Magic-link auth with middleware-guarded routes and a collapsible sidebar shell.",
  "Forms grid, four-tab form detail view, and the unlimited submission archive.",
  "Public landing page with a live demo form, documentation page, pricing page with a Stripe stub, 404, and an app-shell loading state.",
  "A new /demo/submit endpoint on the Worker that runs the real honeypot and spam checks but stores nothing, so the landing page demo works with zero configuration.",
]);

h2("Verification performed");
bullets([
  "Worker typechecks clean with tsc --noEmit.",
  "Dashboard typechecks and produces a successful production build (13 routes).",
  "Special fields exercised against the running Worker: _honey drops silently, _next redirects, _format=json returns JSON, and _blacklist flags spam while stripping itself from the stored payload.",
  "All public dashboard pages rendered and screenshotted in a real browser with no console errors; the landing page demo form completed a real submission.",
]);

callout(
  "Known gap in verification",
  "The authenticated dashboard pages are typechecked and built but were not exercised against live data, because that requires a real Supabase project. Add real credentials to dashboard/.env.local and run the migration to complete this.",
  { tone: "warn" },
);

/* --------------------------------------- 10. Configuration & deploy */

h1("Configuration and deployment");

h2("Worker environment");
table(
  [
    ["SUPABASE_URL", "Supabase project URL."],
    ["SUPABASE_SERVICE_KEY", "Service-role key. Worker secret only — never exposed to a browser."],
    ["RESEND_API_KEY", "Resend key for notification, verification, and autoreply email."],
    ["RESEND_FROM_EMAIL", "Verified sender, e.g. FormFlux <forms@yourdomain.com>."],
    ["HCAPTCHA_SECRET", "Required only when a form enables captcha."],
    ["PUBLIC_BASE_URL", "Public Worker origin, used to build file download links."],
    ["DASHBOARD_URL", "Public dashboard origin, used by upgrade prompts."],
    ["DEFAULT_PLAN", "Plan for owner-less zero-config forms. free by default."],
  ],
  { head: ["Variable", "Purpose"], widths: [0.34, 0.66] },
);

h2("Dashboard environment");
table(
  [
    ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL."],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Anon key. Safe in the browser; all access is filtered by RLS."],
    ["NEXT_PUBLIC_WORKER_URL", "Worker origin the browser should call."],
    ["NEXT_PUBLIC_SITE_URL", "Dashboard origin, used for magic-link redirects."],
    ["STRIPE_SECRET_KEY", "Optional. Enables real Pro checkout; stubbed until set."],
    ["NEXT_PUBLIC_STRIPE_PRICE_ID", "Optional. Stripe price for the Pro subscription."],
  ],
  { head: ["Variable", "Purpose"], widths: [0.4, 0.6] },
);

h2("Cloudflare bindings");
code([
  "npx wrangler kv namespace create RATE_LIMIT_KV",
  "npx wrangler r2 bucket create formflux-uploads",
  "npx wrangler queues create webhook-retries",
  "# cron trigger: 0 3 * * *   (daily retention sweep, already in wrangler.toml)",
]);

h2("Deploy");
code([
  "# Worker",
  "cd worker",
  "npx wrangler secret put SUPABASE_SERVICE_KEY",
  "npx wrangler secret put RESEND_API_KEY",
  "npx wrangler deploy",
  "",
  "# Dashboard (Cloudflare Pages)",
  "cd dashboard",
  "npm run build      # then connect the repo in Pages, or use @cloudflare/next-on-pages",
]);

h2("Outstanding before real public traffic");
bullets(
  [
    "Run supabase/migrations/002_dashboard.sql (or schema.sql on a fresh project).",
    "Verify a sending domain in Resend and update RESEND_FROM_EMAIL — unverified accounts can only email the account owner's own address.",
    "Create the production KV namespace, R2 bucket, and Queue, and paste the KV ids into wrangler.toml.",
    "Point DNS at the Worker and the Pages project, then set PUBLIC_BASE_URL and DASHBOARD_URL.",
    "Add the dashboard's /auth/callback URL to Supabase's allowed redirect list.",
    "Add real hCaptcha keys if captcha will be used.",
    "Add Stripe keys and finish the checkout route if paid upgrades are wanted.",
  ],
  { numbered: true },
);

/* ------------------------------------------------- 11. Flowchart page */

doc.addPage();
sectionNumber += 1;
doc.x = MARGIN;

doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(9);
doc.text(`SECTION ${String(sectionNumber).padStart(2, "0")}`, { characterSpacing: 1.4 });
doc.moveDown(0.35);
doc.fillColor(INK).font("Helvetica-Bold").fontSize(21);
doc.text("Workflow flowchart");
doc.moveDown(0.2);
doc.fillColor(MUTED).font("Helvetica").fontSize(9);
doc.text("End-to-end path of a single form submission through the FormFlux engine.", {
  width: CONTENT_W,
});

/* --- flowchart primitives --- */

// The chart sits right of centre so the left gutter can carry the side notes and
// the right side has room for the rejection branches.
const CX = 322;

function box(y, w, h, label, sub, { fill = "#ffffff", stroke = LINE, textColor = INK, x = CX - w / 2, radius = 6, bold = true } = {}) {
  doc.roundedRect(x, y, w, h, radius).fillColor(fill).fill();
  doc.roundedRect(x, y, w, h, radius).lineWidth(1).strokeColor(stroke).stroke();

  const hasSub = Boolean(sub);
  doc.fillColor(textColor).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.6);
  doc.text(label, x + 6, y + (hasSub ? h / 2 - 11 : h / 2 - 5.5), {
    width: w - 12,
    align: "center",
  });
  if (hasSub) {
    doc.fillColor(textColor === "#ffffff" ? "#e7e5e4" : MUTED).font("Helvetica").fontSize(7);
    doc.text(sub, x + 6, y + h / 2 + 1.5, { width: w - 12, align: "center" });
  }
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, bottom: y + h, right: x + w };
}

function diamond(y, w, h, label) {
  const cx = CX;
  doc
    .moveTo(cx, y)
    .lineTo(cx + w / 2, y + h / 2)
    .lineTo(cx, y + h)
    .lineTo(cx - w / 2, y + h / 2)
    .closePath()
    .fillColor("#fffbeb")
    .fill();
  doc
    .moveTo(cx, y)
    .lineTo(cx + w / 2, y + h / 2)
    .lineTo(cx, y + h)
    .lineTo(cx - w / 2, y + h / 2)
    .closePath()
    .lineWidth(1)
    .strokeColor("#fcd34d")
    .stroke();

  doc.fillColor("#92400e").font("Helvetica-Bold").fontSize(7.8);
  doc.text(label, cx - w / 2 + 14, y + h / 2 - 8, { width: w - 28, align: "center" });
  return { cx, y, h, w, bottom: y + h, left: cx - w / 2, right: cx + w / 2, cy: y + h / 2 };
}

function arrowHead(x, y, direction = "down") {
  const s = 3.6;
  doc.fillColor("#a8a29e");
  if (direction === "down") {
    doc.moveTo(x - s, y - s * 1.6).lineTo(x + s, y - s * 1.6).lineTo(x, y).closePath().fill();
  } else if (direction === "right") {
    doc.moveTo(x - s * 1.6, y - s).lineTo(x - s * 1.6, y + s).lineTo(x, y).closePath().fill();
  } else {
    doc.moveTo(x + s * 1.6, y - s).lineTo(x + s * 1.6, y + s).lineTo(x, y).closePath().fill();
  }
}

function vArrow(fromY, toY, { x = CX, label } = {}) {
  doc.moveTo(x, fromY).lineTo(x, toY).lineWidth(1).strokeColor("#a8a29e").stroke();
  arrowHead(x, toY, "down");
  if (label) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(6.8);
    doc.text(label, x + 5, (fromY + toY) / 2 - 4, { width: 70 });
  }
}

/** Right-hand branch: horizontal out of a diamond, into a side box. */
function branch(fromX, fromY, toBox, label) {
  doc.moveTo(fromX, fromY).lineTo(toBox.x, fromY).lineWidth(1).strokeColor("#a8a29e").stroke();
  arrowHead(toBox.x, fromY, "right");
  doc.fillColor("#b91c1c").font("Helvetica-Bold").fontSize(6.6);
  doc.text(label, fromX + 6, fromY - 9, { width: 60 });
}

const W = 152;
const DW = 138; // diamond width
const DH = 32;
const GAP = 11;
const SIDE_W = 104;
const SIDE_X = CX + 88;
let y = 120;

const start = box(y, W, 24, "Visitor submits the form", null, {
  fill: "#1c1917",
  stroke: "#1c1917",
  textColor: "#ffffff",
});
y = start.bottom + GAP;

vArrow(start.bottom, y);
const route = box(y, W, 27, "Route + parse body", "POST /f/:id  or  /email/:address");
y = route.bottom + GAP;

vArrow(route.bottom, y);
const special = box(y, W, 27, "Extract special fields", "_next _cc _blacklist _webhook ...");
y = special.bottom + GAP;

const gates = [
  ["Honeypot filled?", "YES", "no", "Drop silently", "normal success response", "red"],
  ["Plan allows uploads?", "NO", "yes", "400 upgrade required", "Pro-only feature", "amber"],
  ["Valid + under 10MB?", "NO", "yes", "400 with error list", "field / message pairs", "red"],
  ["Captcha passes?", "NO", "yes / skipped", "400 rejected", "not stored", "red"],
  ["Within rate + quota?", "NO", "yes", "429 too many", "Retry-After header", "amber"],
];

const tones = {
  red: { fill: "#fef2f2", stroke: "#fecaca", textColor: "#991b1b" },
  amber: { fill: "#fff5ed", stroke: "#fecdaa", textColor: "#952a12" },
  grey: { fill: "#f5f5f4", stroke: LINE, textColor: INK_SOFT },
};

for (const [question, branchLabel, passLabel, sideTitle, sideSub, tone] of gates) {
  vArrow(y - GAP, y);
  const d = diamond(y, DW, DH, question);
  const side = box(d.cy - 12, SIDE_W, 24, sideTitle, sideSub, { ...tones[tone], x: SIDE_X });
  branch(d.right, d.cy, side, branchLabel);
  y = d.bottom + GAP + 4;
  doc.fillColor(MUTED).font("Helvetica").fontSize(6.6);
  doc.text(passLabel, CX + 5, d.bottom + 2, { width: 60 });
}

vArrow(y - GAP - 4, y);
const score = box(y, W, 27, "Score for spam", "blocklist + heuristics");
y = score.bottom + GAP;

vArrow(score.bottom, y);
const store = box(y, W, 29, "Store submission", "R2 files + Postgres row + meta", {
  fill: ACCENT_SOFT,
  stroke: "#fecdaa",
  textColor: "#952a12",
});
y = store.bottom + GAP;

vArrow(store.bottom, y);
const spamGate = diamond(y, DW, DH, "Flagged as spam?");
const spamSide = box(spamGate.cy - 16, SIDE_W, 32, "Stored + flagged", "no email or webhooks; owner can rescue it", {
  ...tones.grey,
  x: SIDE_X,
});
branch(spamGate.right, spamGate.cy, spamSide, "YES");
y = spamGate.bottom + GAP + 4;
doc.fillColor(MUTED).font("Helvetica").fontSize(6.6);
doc.text("no", CX + 5, spamGate.bottom + 2, { width: 40 });

vArrow(y - GAP - 4, y);
const deliver = box(y, W, 30, "Deliver", "owner email + autoreply + webhooks", {
  fill: "#ecfdf5",
  stroke: "#a7f3d0",
  textColor: "#065f46",
});
y = deliver.bottom + GAP;

vArrow(deliver.bottom, y);
box(y, W, 27, "Respond to sender", "_next / redirect_url / JSON", {
  fill: "#1c1917",
  stroke: "#1c1917",
  textColor: "#ffffff",
});

/* --- side notes in the left gutter --- */

const NOTE_X = MARGIN;
const NOTE_W = CX - W / 2 - MARGIN - 16;

const notes = [
  ["Async after response", "Failed webhooks are queued and retried with exponential backoff — 60s, 120s, 240s, 480s — for five attempts total. Every attempt is logged."],
  ["Daily at 03:00 UTC", "The retention cron deletes submissions past each form's retention_days and removes their R2 objects."],
  ["Always visible", "The owner sees every submission in the dashboard, spam included, with the exact rules that fired."],
  ["Never a dead end", "Each rejection returns a specific status and a readable reason — JSON for AJAX callers, an HTML page for browser posts."],
];

let ny = 168;
doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.6);
doc.text("Outside the request path", NOTE_X, ny, { width: NOTE_W });
ny = doc.y + 8;

notes.forEach(([title, body]) => {
  doc.font("Helvetica").fontSize(7.2);
  const bodyH = doc.heightOfString(body, { width: NOTE_W - 18, lineGap: 2 });
  const h = bodyH + 22;
  doc.roundedRect(NOTE_X, ny, NOTE_W, h, 5).fillColor("#faf9f8").fill();
  doc.rect(NOTE_X, ny, 2.5, h).fillColor(ACCENT).fill();
  doc.fillColor(ACCENT).font("Helvetica-Bold").fontSize(7);
  doc.text(title.toUpperCase(), NOTE_X + 10, ny + 7, { width: NOTE_W - 18, characterSpacing: 0.4 });
  doc.fillColor(INK_SOFT).font("Helvetica").fontSize(7.2);
  doc.text(body, NOTE_X + 10, doc.y + 1, { width: NOTE_W - 18, lineGap: 2 });
  ny += h + 7;
});

/* ------------------------------------------------------- page footers */

const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i += 1) {
  doc.switchToPage(i);
  if (i === 0) continue; // cover

  // Writing below the bottom margin would make pdfkit append a fresh page for
  // every footer, so drop the margin while stamping it.
  doc.page.margins.bottom = 0;

  doc
    .moveTo(MARGIN, PAGE_H - MARGIN - 8)
    .lineTo(PAGE_W - MARGIN, PAGE_H - MARGIN - 8)
    .lineWidth(0.5)
    .strokeColor(LINE)
    .stroke();

  doc.fillColor(MUTED).font("Helvetica").fontSize(7.6);
  doc.text("FormFlux — Engineering & Workflow Document", MARGIN, PAGE_H - MARGIN + 1, {
    width: CONTENT_W / 2,
  });
  doc.text(`${i + 1} / ${range.count}`, MARGIN + CONTENT_W / 2, PAGE_H - MARGIN + 1, {
    width: CONTENT_W / 2,
    align: "right",
  });

  doc.page.margins.bottom = MARGIN + 24;
}

doc.end();

console.log(`Wrote ${OUT}`);
