import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";

export const metadata = {
  title: "User guide",
  description: "A plain-language guide to collecting form submissions with FormFlux.",
};

const WORKER = (process.env.NEXT_PUBLIC_WORKER_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const ENDPOINT = `${WORKER}/f/YOUR_FORM_ID`;

const HTML_EXAMPLE = `<form action="${ENDPOINT}" method="POST">
  <input type="text" name="name" placeholder="Your name" required />
  <input type="email" name="email" placeholder="Your email" required />
  <textarea name="message" placeholder="Your message" required></textarea>

  <!-- hidden trap for bots: leave it empty and hidden -->
  <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off" />

  <button type="submit">Send</button>
</form>`;

const FETCH_EXAMPLE = `<form id="contact">
  <input type="text" name="name" required />
  <input type="email" name="email" required />
  <textarea name="message" required></textarea>
  <button type="submit">Send</button>
</form>

<script>
  document.getElementById("contact").addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch("${ENDPOINT}", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(event.target),
    });
    const result = await response.json();
    // Errors come back as { success: false, errors: [{ field, message }] } for
    // invalid fields, or { success: false, error: "..." } for everything else.
    const problem = result.errors
      ? result.errors.map((e) => e.message).join(", ")
      : result.error;
    alert(result.success ? "Thanks! We got your message." : problem);
  });
</script>`;

const REACT_EXAMPLE = `import { useState } from "react";

export function ContactForm() {
  const [status, setStatus] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("Sending…");
    const response = await fetch("${ENDPOINT}", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(event.currentTarget),
    });
    const result = await response.json();
    // { success: false, errors: [{ field, message }] } or { success: false, error }
    const problem = result.errors
      ? result.errors.map((e) => e.message).join(", ")
      : result.error;
    setStatus(result.success ? "Thanks! We got your message." : problem);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" name="name" required />
      <input type="email" name="email" required />
      <textarea name="message" required />
      <button type="submit">Send</button>
      <p>{status}</p>
    </form>
  );
}`;

const UPLOAD_EXAMPLE = `<form action="${ENDPOINT}" method="POST" enctype="multipart/form-data">
  <input type="email" name="email" required />
  <input type="file" name="attachment" />
  <button type="submit">Send</button>
</form>`;

const CAPTCHA_EXAMPLE = `<div class="h-captcha" data-sitekey="YOUR_HCAPTCHA_SITEKEY"></div>
<script src="https://js.hcaptcha.com/1/api.js" async defer></script>`;

const OPTIONS: [string, string][] = [
  ["_next", "Where to send the visitor after they submit, for example your own thank-you page. Overrides the form's default redirect."],
  ["_subject", "The subject line of the email you receive."],
  ["_honey", "A hidden trap for bots (_honeypot works too). People never see it; if a bot fills it in, the submission is quietly thrown away."],
  ["_replyto", "Lets you hit Reply in your inbox and answer the sender directly."],
  ["_cc", "Extra people to copy on the email, separated by commas."],
  ["_blacklist", "Words or phrases, separated by commas (up to 20), that mark a submission as spam."],
  ["_captcha", `Ignored when the form requires a captcha, so it cannot be used to get around it.`],
  ["_autoresponse", "A custom thank-you email sent to the visitor. You can use {{name}}-style placeholders. Pro plan."],
  ["_template", `Look of the email you receive: "table" (the default) or "plain".`],
  ["_webhook", "An extra web address that receives a copy of the submission. Pro plan."],
  ["_format", `Set to "json" to get a short JSON reply instead of being redirected (useful with JavaScript).`],
];

const TROUBLESHOOTING: [string, string][] = [
  ["I submitted the form but got no email.", "Email delivery is not fully live yet — right now it only reaches the FormFlux owner's address, so look in the dashboard. Custom-domain email delivery is coming soon. Otherwise, check your spam folder. If you used the email-address URL, you must click the verification link FormFlux sent you before anything is delivered. Submissions flagged as spam are saved but never emailed. Every submission still shows up in the dashboard, so look there too."],
  ["It says “This form is not verified yet”.", "You are using the email-address URL. Open the verification email FormFlux sent to that address and click the link once. After that, submissions go through."],
  ["It says the captcha is required.", "Captcha is not available yet. Switch off Require hCaptcha in the form's settings and try again."],
  ["It says “Too many submissions” or a rate limit was hit.", "Each form accepts a set number of submissions per hour (100 by default) from the same visitor. Wait a while, or raise the limit in the form's settings."],
  ["File uploads are rejected.", "File uploads are not available yet. When they are, they'll need the Pro plan, enctype=\"multipart/form-data\" on the form, and 10 MB or less in total (10 files at most)."],
  ["Some fields come back with errors.", "Your form has validation rules (Settings → Validation rules). The reply lists which fields failed so you can show the message to the visitor."],
  ["I can't sign in.", "Sign-in uses a magic link. For now those emails only reach the FormFlux owner's address, until FormFlux's sending domain is set up. If you are the owner, use the newest link in your inbox, open it in the same browser, and check your spam folder."],
];

const FAQ: [string, string][] = [
  ["Do I need to write any server code?", "No. You point your form at a FormFlux address and FormFlux does the rest."],
  ["Do I need a password?", "No. You sign in with a magic link sent to your email (for now, only the FormFlux owner's address receives these)."],
  ["Is my email address visible on my website?", "Only if you use the email-address URL. A dashboard form uses a random ID instead, so your address stays private."],
  ["Can I use any website builder?", "Yes, as long as you can paste HTML or add a form that posts to a web address."],
  ["How long are submissions kept?", "Each form has a retention setting (90 days by default). A daily clean-up removes submissions older than that, along with their files."],
  ["Can I search old submissions?", "Yes. The Archive page searches every submission across all your forms."],
  ["How do I get Pro?", "Paid upgrades are coming later. For now, every account is on the free plan."],
];

function Snippet({ title, description, code, language = "html" }: { title: string; description: string; code: string; language?: string }) {
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

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-20">
      <h2 className="text-2xl font-bold tracking-tightest">{title}</h2>
      <div className="mt-3 space-y-4 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function List({ items }: { items: [string, string][] }) {
  return (
    <dl className="mt-6 divide-y">
      {items.map(([term, description]) => (
        <div key={term} className="grid gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6">
          <dt className="text-[0.85rem] font-semibold tracking-tight">{term}</dt>
          <dd className="text-[0.88rem] leading-relaxed text-muted">{description}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function GuidePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-extrabold tracking-tightest sm:text-4xl">User guide</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          Everything you need to collect messages from your website, in plain language. No coding
          experience needed for the basics. Looking for the technical reference? See the{" "}
          <Link href="/docs" className="underline">docs</Link>.
        </p>

        <Section id="what" title="What is FormFlux?">
          <p>
            FormFlux receives the forms on your website — contact forms, sign-ups, enquiries — and
            sends each submission to your email (custom-domain email delivery is coming soon). It also keeps a copy in your dashboard so you can
            read, search and manage them later. You don&apos;t need your own server.
          </p>
        </Section>

        <Section id="sign-in" title="Signing up and logging in">
          <p>
            Go to <Link href="/login" className="underline">Sign in</Link>, type your email and press{" "}
            <strong>Send magic link</strong>. Open the email and click the link — you&apos;re in. There
            is no password to remember. Signing in for the first time creates your account on the
            free plan.
          </p>
          <p>
            <strong>Note:</strong> until FormFlux&apos;s own sending domain is set up, magic-link
            emails only reach the FormFlux owner&apos;s address, so other people can&apos;t sign in yet.
          </p>
        </Section>

        <Section id="create" title="Creating a form and getting its address">
          <p>
            In the dashboard, open <strong>Forms</strong> and create a new form. Give it a name and
            the email address where submissions should go. FormFlux gives the form its own address
            (its &ldquo;endpoint&rdquo;), which looks like this:
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-stone-100 p-3 font-mono text-[0.74rem] text-stone-700 dark:bg-stone-800/60 dark:text-stone-300">
            {ENDPOINT}
          </pre>
          <p>
            Open the form and go to its <strong>Settings</strong> tab: the <strong>Copy this HTML</strong>{" "}
            box contains a ready-made form with your real address already filled in.
          </p>
          <p>
            In a hurry? You can also skip the dashboard and use{" "}
            <code className="break-all">{WORKER}/email/you@example.com</code> as the address. The first submission sends
            you a verification email; click it once and you&apos;re set. (Until custom-domain email delivery is live, that verification email only reaches the FormFlux owner&apos;s address, so for now use a dashboard form.) This shows your email
            address in your page&apos;s code, so switch to a dashboard form before going live.
          </p>
        </Section>

        <Section id="connect" title="Connecting it to your website">
          <p>Pick whichever matches your site. Replace YOUR_FORM_ID with the ID from your dashboard.</p>
          <div className="space-y-6">
            <Snippet title="Copy-paste HTML" description="Works on any website or site builder that lets you add HTML." code={HTML_EXAMPLE} />
            <Snippet title="JavaScript (fetch)" description="Keeps visitors on the page and shows a message instead of redirecting." code={FETCH_EXAMPLE} language="javascript" />
            <Snippet title="React" description="A ready-made contact form component." code={REACT_EXAMPLE} language="javascript" />
          </div>
        </Section>

        <Section id="options" title="Hidden fields and options">
          <p>
            Add these as hidden inputs, like{" "}
            <code>&lt;input type=&quot;hidden&quot; name=&quot;_subject&quot; value=&quot;New enquiry&quot; /&gt;</code>.
            They change how one submission is handled and are removed before the submission is
            saved or emailed. Many of them can also be set once for the whole form in its settings.
          </p>
          <List items={OPTIONS} />
        </Section>

        <Section id="uploads" title="File uploads (not available yet)">
          <p>
            <strong>Not available yet:</strong> file storage is still being set up, so uploads
            can&apos;t be accepted right now. When it&apos;s ready, file uploads will be part of the Pro plan. Add a file input and set{" "}
            <code>enctype=&quot;multipart/form-data&quot;</code> on the form. Each submission can
            include up to 10 files, 10 MB in total. The email you receive contains download links.
          </p>
          <Snippet title="Form with a file upload" description="The enctype attribute is required for files." code={UPLOAD_EXAMPLE} />
        </Section>

        <Section id="what-happens" title="What happens when someone submits">
          <ol className="list-decimal space-y-2 pl-5">
            <li>FormFlux checks the submission: the bot trap, captcha (if on), your validation rules and the hourly limit.</li>
            <li>It is saved to your dashboard, where you can see it under the form&apos;s <strong>Submissions</strong> tab.</li>
            <li>An email with every field is sent to you. <strong>Email delivery is not fully live yet:</strong> until FormFlux&apos;s own sending domain is set up, notification emails only reach the FormFlux owner&apos;s address, so check the dashboard for your submissions. Custom-domain email delivery is coming soon. On Pro, an automatic thank-you email can go to the visitor, and webhooks can send a copy to Slack, Discord or another app.</li>
            <li>The visitor is taken to a thank-you page — yours if you set one, otherwise FormFlux&apos;s.</li>
            <li>Every submission stays searchable on the <strong>Archive</strong> page until it reaches the form&apos;s retention limit.</li>
          </ol>
        </Section>

        <Section id="spam" title="Spam protection and captcha">
          <p>FormFlux protects your forms in several ways:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Bot trap:</strong> the hidden <code>_honey</code> field. Bots that fill it in are silently ignored.</li>
            <li><strong>Spam filter:</strong> messages with 3 or more links or common spam phrases, or words from your blacklist, are saved and marked as spam but never emailed. The sender still sees a normal success message.</li>
            <li><strong>Captcha (not available yet):</strong> captcha checking is still being set up. Please leave <strong>Require hCaptcha</strong> switched off for now — while it&apos;s on, submissions can&apos;t get through. Once it&apos;s live, you&apos;ll add the hCaptcha box below to your page.</li>
            <li><strong>Hourly limit:</strong> stops one visitor from flooding a form.</li>
          </ul>
          <p>If a real message was marked as spam by mistake, you can correct it from the dashboard.</p>
          <Snippet title="hCaptcha box" description="Not available yet. For later: paste inside your form, using your own hCaptcha site key." code={CAPTCHA_EXAMPLE} />
        </Section>

        <Section id="settings" title="Settings">
          <p>Each form&apos;s Settings tab has these sections:</p>
          <List
            items={[
              ["Delivery", "Form name, the email that receives submissions, a default subject line, default CC and a default redirect page."],
              ["Spam protection", "Turn hCaptcha on or off and manage blacklist phrases."],
              ["Webhooks", "Send each submission to your own web addresses, Slack or Discord (Pro)."],
              ["Autoreply", "An automatic thank-you email to the visitor (Pro)."],
              ["Validation rules", "Make fields required or check them against a pattern."],
              ["Retention & limits", "How many days to keep submissions (90 by default) and how many submissions per hour to accept (100 by default)."],
            ]}
          />
          <p>
            The account <Link href="/settings" className="underline">Settings</Link> page shows your
            plan and usage.
          </p>
        </Section>

        <Section id="plans" title="Limits and plans">
          <List
            items={[
              ["Free", "1 form and 50 submissions per month. Dashboard, archive and spam protection are included. Email delivery is coming soon and captcha isn't available yet."],
              ["Pro", "Unlimited forms and submissions, plus webhooks, autoreply and analytics. File uploads are not available yet."],
              ["Upgrading", "Paid upgrades are coming later. For now, every account is on the free plan."],
            ]}
          />
        </Section>

        <Section id="troubleshooting" title="Troubleshooting">
          <List items={TROUBLESHOOTING} />
        </Section>

        <Section id="faq" title="FAQ">
          <List items={FAQ} />
        </Section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Button asChild variant="primary">
            <Link href="/login">Create a form</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/docs">Read the docs</Link>
          </Button>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
