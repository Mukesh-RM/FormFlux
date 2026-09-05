import { Hono } from "hono";
import { parseSubmission } from "../lib/form-body";
import { detectSpam } from "../lib/spam";
import { parseSpecialFields, stripSpecialFields } from "../lib/special-fields";
import type { Bindings } from "../lib/supabase";

export const demoRoutes = new Hono<{ Bindings: Bindings }>();

demoRoutes.get("/", (c) => {
  const accept = c.req.header("Accept") || "";
  if (accept.includes("application/json") && !accept.includes("text/html")) {
    return c.json({ name: "FormFlux", status: "ok", phase: 5 });
  }
  return c.html(landingPage());
});

/**
 * Live demo endpoint used by the landing page and the local demo UI. It runs the
 * real honeypot, blacklist, and spam checks but never touches Supabase, R2, or
 * Resend — so it works with zero configuration and stores nothing.
 */
demoRoutes.post("/demo/submit", async (c) => {
  const { fields } = await parseSubmission(c);
  const special = parseSpecialFields(fields);
  const wantsJson =
    special.wantsJson || (c.req.header("Accept") || "").includes("application/json");

  if (special.honeypot.length > 0) {
    // Bots get the same happy answer as humans.
    return wantsJson
      ? c.json({ success: true, submissionId: "demo-dropped", demo: true })
      : c.redirect("/thanks", 302);
  }

  const missing = ["name", "email", "message"].filter((field) => !(fields[field] || "").trim());
  if (missing.length > 0) {
    const errors = missing.map((field) => ({ field, message: `${field} is required` }));
    return wantsJson ? c.json({ success: false, errors }, 400) : c.redirect("/demo/invalid", 302);
  }

  const spam = detectSpam(fields, special.blacklist);

  if (wantsJson) {
    return c.json({
      success: true,
      demo: true,
      submissionId: crypto.randomUUID(),
      isSpam: spam.isSpam,
      spamReasons: spam.reasons,
      specialFields: special.used,
      received: stripSpecialFields(fields),
      note: "Demo endpoint — nothing was stored and no email was sent.",
    });
  }

  if (special.next) return c.redirect(special.next, 302);
  return c.redirect("/thanks", 302);
});

demoRoutes.get("/thanks", (c) => c.html(statusPage("Thanks", thankYouBody())));
demoRoutes.get("/demo/inbox", (c) => c.html(statusPage("Check your inbox", inboxBody())));
demoRoutes.get("/demo/invalid", (c) =>
  c.html(
    statusPage(
      "Submission invalid",
      `<h1>Please fix the following</h1>
       <ul>
         <li><strong>email</strong>: email is required</li>
         <li><strong>message</strong>: message does not match the required format</li>
       </ul>
       <p><a href="/">Back to demo</a></p>`,
    ),
    400,
  ),
);

function landingPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FormFlux · localhost demo</title>
    <style>
      :root {
        --ink: #0f172a;
        --muted: #64748b;
        --line: #e2e8f0;
        --bg: #f8fafc;
        --card: #ffffff;
        --accent: #2563eb;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
        background: radial-gradient(1200px 500px at 10% -10%, #dbeafe 0%, transparent 50%), var(--bg);
        color: var(--ink);
      }
      header, main, footer { width: min(1080px, calc(100% - 2rem)); margin-inline: auto; }
      header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 1.25rem 0 0.5rem;
      }
      .brand { font-weight: 800; letter-spacing: -0.03em; font-size: 1.25rem; }
      .brand span { color: var(--accent); }
      nav a { color: var(--muted); text-decoration: none; margin-left: 1rem; font-size: 0.92rem; }
      nav a:hover { color: var(--ink); }
      .hero { padding: 2.5rem 0 1.5rem; }
      .hero h1 { font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.1; margin: 0 0 0.75rem; letter-spacing: -0.04em; }
      .hero p { color: var(--muted); font-size: 1.1rem; max-width: 40rem; line-height: 1.6; }
      .pills { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.25rem; }
      .pill { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; border-radius: 999px; padding: 0.35rem 0.75rem; font-size: 0.8rem; font-weight: 600; }
      .grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 1.25rem; padding-bottom: 3rem; }
      @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
      .card {
        background: var(--card); border: 1px solid var(--line); border-radius: 1.15rem;
        padding: 1.35rem 1.4rem; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
      }
      .card h2 { margin: 0 0 0.35rem; font-size: 1.15rem; }
      .card .hint { color: var(--muted); font-size: 0.92rem; margin: 0 0 1rem; line-height: 1.5; }
      label { display: block; font-size: 0.82rem; font-weight: 650; margin: 0.7rem 0 0.3rem; }
      input, textarea {
        width: 100%; border: 1px solid var(--line); border-radius: 0.7rem; padding: 0.7rem 0.8rem;
        font: inherit; background: #fff; color: var(--ink);
      }
      input:focus, textarea:focus { outline: 2px solid #bfdbfe; border-color: var(--accent); }
      textarea { min-height: 7rem; resize: vertical; }
      button {
        margin-top: 1rem; width: 100%; border: 0; border-radius: 0.75rem; padding: 0.85rem 1rem;
        background: var(--ink); color: #fff; font: inherit; font-weight: 700; cursor: pointer;
      }
      button:hover { background: #1e293b; }
      .file { font-size: 0.85rem; color: var(--muted); }
      pre {
        margin: 0; overflow: auto; background: #0f172a; color: #e2e8f0; border-radius: 0.85rem;
        padding: 1rem; font-size: 0.78rem; line-height: 1.55;
      }
      .links { display: grid; gap: 0.55rem; }
      .links a {
        display: block; text-decoration: none; color: var(--ink); border: 1px solid var(--line);
        border-radius: 0.8rem; padding: 0.75rem 0.9rem; background: #fff;
      }
      .links a:hover { border-color: #93c5fd; background: #eff6ff; }
      .links small { display: block; color: var(--muted); margin-top: 0.15rem; }
      footer { color: var(--muted); font-size: 0.85rem; padding: 0 0 2rem; }
      table.fields { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
      table.fields td { padding: 0.45rem 0; border-bottom: 1px solid var(--line); vertical-align: top; color: var(--muted); }
      table.fields td:first-child { width: 42%; color: var(--ink); }
      code { background: #f1f5f9; border-radius: 0.3rem; padding: 0.1rem 0.3rem; font-size: 0.85em; }
      pre code { background: none; padding: 0; }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">Form<span>Flux</span></div>
      <nav>
        <a href="/verified">Verified page</a>
        <a href="/thanks">Thanks page</a>
        <a href="/demo/inbox">Inbox page</a>
      </nav>
    </header>
    <main>
      <section class="hero">
        <h1>A FormSubmit-style backend, running on localhost.</h1>
        <p>This is the Phase 3 Worker UI: a live demo form plus the real pages people see after submit, verify, and errors. The API still returns JSON when you send <code>Accept: application/json</code>.</p>
        <div class="pills">
          <span class="pill">Email delivery</span>
          <span class="pill">hCaptcha + rate limits</span>
          <span class="pill">R2 uploads</span>
          <span class="pill">Webhooks</span>
          <span class="pill">Autoreply</span>
        </div>
      </section>
      <section class="grid">
        <div class="card">
          <h2>Try a submission</h2>
          <p class="hint">This demo posts to a preview endpoint so you can see the thank-you page without Supabase credentials. Wire a real form to <code>/f/:formId</code> or <code>/email/you@domain.com</code> once <code>.dev.vars</code> is set.</p>
          <form action="/demo/submit" method="POST" enctype="multipart/form-data">
            <label for="name">Name</label>
            <input id="name" name="name" value="Ada Lovelace" required />
            <label for="email">Email</label>
            <input id="email" name="email" type="email" value="ada@example.com" required />
            <label for="message">Message</label>
            <textarea id="message" name="message">Hello from the FormFlux localhost demo.</textarea>
            <label for="attachment">Attachment</label>
            <input id="attachment" class="file" name="attachment" type="file" />
            <input type="text" name="_honeypot" style="display:none" tabindex="-1" autocomplete="off" />
            <input type="hidden" name="_subject" value="Localhost demo" />
            <button type="submit">Send message</button>
          </form>
        </div>
        <div>
          <div class="card" style="margin-bottom:1.25rem;">
            <h2>Other screens</h2>
            <p class="hint">These are the same HTML templates the Worker returns to real users.</p>
            <div class="links">
              <a href="/thanks"><strong>Thank-you page</strong><small>Shown after a successful HTML form post</small></a>
              <a href="/verified"><strong>Email verified</strong><small>After clicking GET /verify/:token</small></a>
              <a href="/demo/inbox"><strong>Check your inbox</strong><small>Zero-config form waiting for verification</small></a>
              <a href="/demo/invalid"><strong>Validation errors</strong><small>400 page when required fields fail</small></a>
            </div>
          </div>
          <div class="card">
            <h2>Drop-in HTML</h2>
            <p class="hint">Every FormSubmit special field works here. The UUID endpoint (<code>/f/:id</code>) keeps your real address out of page source.</p>
            <pre>&lt;form action="http://127.0.0.1:8787/f/YOUR_FORM_UUID"
      method="POST"
      enctype="multipart/form-data"&gt;
  &lt;input name="name" required /&gt;
  &lt;input name="email" type="email" required /&gt;
  &lt;textarea name="message"&gt;&lt;/textarea&gt;
  &lt;input name="attachment" type="file" /&gt;

  &lt;!-- spam trap: bots fill it, humans never see it --&gt;
  &lt;input type="text" name="_honey" style="display:none" /&gt;

  &lt;!-- email shaping --&gt;
  &lt;input type="hidden" name="_subject" value="New lead" /&gt;
  &lt;input type="hidden" name="_cc" value="team@example.com" /&gt;
  &lt;input type="hidden" name="_replyto" value="ada@example.com" /&gt;
  &lt;input type="hidden" name="_template" value="table" /&gt;

  &lt;!-- per-submission overrides --&gt;
  &lt;input type="hidden" name="_next" value="https://example.com/thanks" /&gt;
  &lt;input type="hidden" name="_blacklist" value="viagra, casino, free money" /&gt;
  &lt;input type="hidden" name="_captcha" value="false" /&gt;
  &lt;input type="hidden" name="_webhook" value="https://example.com/hook" /&gt;
  &lt;input type="hidden" name="_autoresponse" value="Thanks {{name}}!" /&gt;

  &lt;button&gt;Send&lt;/button&gt;
&lt;/form&gt;</pre>
          </div>
          <div class="card" style="margin-top:1.25rem;">
            <h2>Special fields</h2>
            <p class="hint">Full reference, all live in this Worker.</p>
            <table class="fields">
              <tr><td><code>_subject</code></td><td>Email subject line</td></tr>
              <tr><td><code>_cc</code></td><td>Comma-separated CC recipients</td></tr>
              <tr><td><code>_replyto</code></td><td>Reply-To header</td></tr>
              <tr><td><code>_template</code></td><td><code>table</code> or <code>plain</code></td></tr>
              <tr><td><code>_next</code></td><td>Redirect for this submission only</td></tr>
              <tr><td><code>_blacklist</code></td><td>Phrases that silently mark it spam (20 max)</td></tr>
              <tr><td><code>_captcha</code></td><td><code>false</code> skips hCaptcha once</td></tr>
              <tr><td><code>_webhook</code></td><td>Extra one-off webhook URL</td></tr>
              <tr><td><code>_autoresponse</code></td><td>Custom autoreply body</td></tr>
              <tr><td><code>_honey</code> / <code>_honeypot</code></td><td>Bot trap; filled = dropped</td></tr>
              <tr><td><code>_format=json</code></td><td>AJAX mode; returns JSON</td></tr>
            </table>
          </div>
        </div>
      </section>
    </main>
    <footer>FormFlux Phase 3 · Cloudflare Workers + Hono + Supabase + Resend + R2</footer>
  </body>
</html>`;
}

function statusPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} · FormFlux</title>
    <style>
      :root { color-scheme: light; }
      body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background:#f1f5f9; color:#0f172a; }
      main { max-width: 40rem; margin: 12vh auto; background:#fff; padding:2rem; border-radius:1rem; border:1px solid #e2e8f0; }
      h1 { margin-top:0; font-size:1.6rem; }
      p, li { line-height:1.6; color:#334155; }
      a { color:#2563eb; }
      .brand { font-size:0.75rem; letter-spacing:0.12em; text-transform:uppercase; color:#64748b; margin-bottom:0.75rem; }
    </style>
  </head>
  <body>
    <main>
      <div class="brand">FormFlux</div>
      ${body}
    </main>
  </body>
</html>`;
}

function thankYouBody(): string {
  return `<h1>Submission received</h1>
    <p>Thank you. Your form was submitted successfully.</p>
    <p><a href="/">Back to demo</a></p>`;
}

function inboxBody(): string {
  return `<h1>Check your inbox</h1>
    <p>We sent a verification link to <strong>you@example.com</strong>.</p>
    <p>Click that link once, then submit this form again. Until then, submissions are not delivered.</p>
    <p><a href="/">Back to demo</a></p>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
