import { Hono, type Context } from "hono";
import { captchaToken, verifyHCaptcha } from "../lib/captcha";
import {
  detectSubmitterEmail,
  fromAddress,
  sendAutoreplyEmail,
  sendSubmissionEmail,
  sendVerificationEmail,
} from "../lib/email";
import { parseSubmission } from "../lib/form-body";
import {
  deleteStoredFiles,
  fileDownloadUrl,
  publicOrigin,
  storeUploads,
  validateUploads,
} from "../lib/files";
import { loadPlan, monthlySubmissionCount, planFeatures } from "../lib/plan";
import { consumeRateLimit } from "../lib/rate-limit";
import { detectSpam } from "../lib/spam";
import {
  MAX_BLACKLIST_PHRASES,
  parseSpecialFields,
  stripSpecialFields,
  type SpecialFields,
} from "../lib/special-fields";
import { createSupabase, type Bindings, type FormRow, type ValidationRules } from "../lib/supabase";
import { deliverSubmissionWebhooks } from "../lib/webhooks";

type AppContext = Context<{ Bindings: Bindings }>;
type ParsedBody = Record<string, string>;
type ValidationError = {
  field: string;
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export const submitRoutes = new Hono<{ Bindings: Bindings }>();

submitRoutes.post("/f/:formId", async (c) => {
  const formId = c.req.param("formId");
  const supabase = createSupabase(c.env);
  const { data, error } = await supabase.from("forms").select("*").eq("id", formId).maybeSingle();

  if (error) {
    console.error("Failed to load form:", error.message);
    return c.json({ success: false, error: "Unable to load form" }, 500);
  }

  const form = data as FormRow | null;
  if (!form) {
    return c.json({ success: false, error: "Form not found" }, 404);
  }

  const { fields, files } = await parseSubmission(c);
  return handleSubmission(c, form, fields, files);
});

submitRoutes.post("/email/:encodedEmail{.+}", async (c) => {
  const encodedEmail = c.req.param("encodedEmail");
  const email = decodeTargetEmail(encodedEmail);
  if (!email) {
    return c.json({ success: false, error: "Invalid email address in URL" }, 400);
  }

  const { fields, files } = await parseSubmission(c);
  const special = parseSpecialFields(fields);

  if (special.honeypot.length > 0) {
    console.warn("Honeypot triggered; dropping zero-config submission", {
      email,
      ip: clientIp(c),
    });
    return successResponse(c, special, null, crypto.randomUUID(), "free");
  }

  const supabase = createSupabase(c.env);
  const { data: existing, error: lookupError } = await supabase
    .from("forms")
    .select("*")
    .eq("target_email", email)
    .order("created_at", { ascending: true })
    .limit(1);

  if (lookupError) {
    console.error("Failed to look up zero-config form:", lookupError.message);
    return c.json({ success: false, error: "Unable to load form" }, 500);
  }

  let form = (existing?.[0] as FormRow | undefined) ?? null;

  if (!form) {
    const verificationToken = randomToken();
    const { data: created, error: createError } = await supabase
      .from("forms")
      .insert({
        name: `Form for ${email}`,
        target_email: email,
        is_verified: false,
        verification_token: verificationToken,
      })
      .select("*")
      .single();

    if (createError || !created) {
      console.error("Failed to create zero-config form:", createError?.message);
      return c.json({ success: false, error: "Unable to create form" }, 500);
    }

    form = created as FormRow;
    const verifyUrl = `${new URL(c.req.url).origin}/verify/${verificationToken}`;
    const sent = await sendVerificationEmail({
      apiKey: c.env.RESEND_API_KEY,
      from: fromAddress(c.env.RESEND_FROM_EMAIL),
      to: email,
      verifyUrl,
    });

    if (!sent.sent) {
      console.error("Verification email was not sent:", sent.error);
    }

    return unverifiedResponse(c, email, special);
  }

  if (!form.is_verified) {
    return unverifiedResponse(c, email, special);
  }

  return handleSubmission(c, form, fields, files);
});

async function handleSubmission(c: AppContext, form: FormRow, fields: ParsedBody, files: File[]) {
  const ip = clientIp(c);
  const special = parseSpecialFields(fields);
  const plan = await loadPlan(c.env, form.owner_id);
  const features = planFeatures(plan);

  // `_honeypot` (FormFlux) and `_honey` (FormSubmit) both drop the post silently.
  if (special.honeypot.length > 0) {
    console.warn("Honeypot triggered; dropping submission", { formId: form.id, ip });
    return successResponse(c, special, form, crypto.randomUUID(), plan);
  }

  if (files.length > 0 && !features.fileUploads) {
    return upgradeResponse(
      c,
      special,
      "File uploads are a Pro feature. Upgrade your FormFlux plan to accept attachments on this form.",
    );
  }

  const uploadError = validateUploads(files);
  if (uploadError) {
    return errorResponse(c, special, uploadError, 400);
  }

  const errors = validateFields(fields, form.validation_rules);
  if (errors.length > 0) {
    return validationErrorResponse(c, special, errors);
  }

  // `_captcha=false` is a per-submission override of the form-level captcha setting.
  let captchaState: "not_required" | "passed" | "skipped_by_field" = "not_required";
  if (form.captcha_enabled && special.captchaDisabled) {
    captchaState = "skipped_by_field";
    console.info("Captcha skipped via _captcha=false", { formId: form.id });
  } else if (form.captcha_enabled) {
    const captcha = await verifyHCaptcha({
      secret: c.env.HCAPTCHA_SECRET || "",
      token: captchaToken(fields),
      ip,
    });
    if (!captcha.ok) {
      return captchaErrorResponse(c, special, captcha.error);
    }
    captchaState = "passed";
  }

  const limit = form.rate_limit_per_hour ?? 100;
  const rate = await consumeRateLimit(c.env.RATE_LIMIT_KV, { formId: form.id, ip, limit });
  if (!rate.allowed) {
    return rateLimitResponse(c, special, rate.limit, rate.retryAfterSeconds);
  }

  if (features.monthlySubmissions !== null) {
    const used = await monthlySubmissionCount(c.env, form.owner_id, form.id);
    if (used >= features.monthlySubmissions) {
      return upgradeResponse(
        c,
        special,
        `This form reached the free plan limit of ${features.monthlySubmissions} submissions this month. Upgrade to Pro for unlimited submissions.`,
        429,
      );
    }
  }

  // Per-submission `_blacklist` phrases are merged with the form's saved list,
  // then capped so a hostile body cannot force an expensive scan.
  const blacklist = [...special.blacklist, ...(form.blacklist_phrases ?? [])]
    .map((phrase) => phrase.trim().toLowerCase())
    .filter((phrase) => phrase.length > 0)
    .slice(0, MAX_BLACKLIST_PHRASES);

  const spam = detectSpam(fields, blacklist);
  if (spam.isSpam) {
    console.warn("Submission flagged as spam", { formId: form.id, ip, reasons: spam.reasons });
  }

  const submissionId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  let fileKeys: string[] = [];

  try {
    const stored = await storeUploads(c.env.FORM_UPLOADS, form.id, submissionId, files);
    fileKeys = stored.map((file) => file.key);
  } catch (error) {
    console.error("Failed to store uploads:", error);
    return errorResponse(c, special, "Unable to store uploaded files", 500);
  }

  const redirectTarget = resolveRedirect(special.next, form.redirect_url);
  const supabase = createSupabase(c.env);
  const { data: submission, error: insertError } = await supabase
    .from("submissions")
    .insert({
      id: submissionId,
      form_id: form.id,
      data: stripSpecialFields(fields),
      files: fileKeys,
      ip_address: ip,
      is_spam: spam.isSpam,
      delivered: false,
      created_at: createdAt,
      meta: {
        specialFields: special.used,
        captcha: captchaState,
        spamReasons: spam.reasons,
        redirect: redirectTarget,
        plan,
        extraWebhook: special.webhook,
        fileCount: fileKeys.length,
      },
    })
    .select("id")
    .single();

  if (insertError || !submission) {
    console.error("Failed to insert submission:", insertError?.message);
    await deleteStoredFiles(c.env.FORM_UPLOADS, fileKeys);
    return errorResponse(c, special, "Unable to save submission", 500);
  }

  const origin = publicOrigin(c.env.PUBLIC_BASE_URL, c.req.url);
  const fileLinks = fileKeys.map((key) => {
    const filename = key.split("/").pop() || key;
    return { filename, url: fileDownloadUrl(origin, form.id, submissionId, filename) };
  });

  let delivered = false;
  if (spam.isSpam) {
    // Silent drop: the sender still gets a normal success response below so they
    // cannot tell which phrase or heuristic caught them.
    console.info("Skipping email and webhook delivery for spam submission", { submissionId });
  } else {
    if (form.target_email) {
      const result = await sendSubmissionEmail({
        apiKey: c.env.RESEND_API_KEY,
        from: fromAddress(c.env.RESEND_FROM_EMAIL),
        to: form.target_email,
        data: fields,
        fileLinks,
        subject: special.subject || form.default_subject,
        cc: special.cc || form.default_cc,
        // Without an explicit _replyto, replying to the notification should reach
        // whoever submitted the form.
        replyTo: special.replyTo || detectSubmitterEmail(fields),
        template: special.template,
      });
      delivered = result.delivered;
    } else {
      console.warn("Form has no target_email; skipping delivery", { formId: form.id });
    }

    if (form.autoreply_enabled || special.autoresponse) {
      if (features.autoreply) {
        await sendAutoreplyEmail({
          apiKey: c.env.RESEND_API_KEY,
          from: fromAddress(c.env.RESEND_FROM_EMAIL),
          fields,
          // `_autoresponse` overrides the saved template for this submission only.
          template: special.autoresponse || form.autoreply_template,
        });
      } else {
        console.info("Autoreply skipped; Pro feature", { formId: form.id });
      }
    }

    if (features.webhooks) {
      await deliverSubmissionWebhooks(c.env, {
        form,
        submissionId,
        createdAt,
        data: fields,
        fileKeys,
        origin,
        extraWebhook: special.webhook,
      });
    } else if (hasAnyWebhook(form, special)) {
      console.info("Webhooks skipped; Pro feature", { formId: form.id });
    }
  }

  if (delivered) {
    const { error: updateError } = await supabase
      .from("submissions")
      .update({ delivered: true })
      .eq("id", submissionId);
    if (updateError) {
      console.error("Failed to mark submission delivered:", updateError.message);
    }
  }

  return successResponse(c, special, form, submissionId, plan, redirectTarget);
}

function hasAnyWebhook(form: FormRow, special: SpecialFields): boolean {
  return Boolean(
    (form.webhook_urls ?? []).length > 0 ||
      form.slack_webhook_url ||
      form.discord_webhook_url ||
      special.webhook,
  );
}

/** `_next` wins over the stored default, but only when it is a real http(s) URL. */
function resolveRedirect(next: string | null, fallback: string | null): string | null {
  if (next && isSafeRedirect(next)) return next;
  if (next) console.warn("Ignoring unsafe _next value", next);
  if (fallback && isSafeRedirect(fallback)) return fallback;
  return null;
}

function validateFields(fields: ParsedBody, rules: ValidationRules | null): ValidationError[] {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) return [];

  const errors: ValidationError[] = [];
  for (const [field, rule] of Object.entries(rules)) {
    if (!rule || typeof rule !== "object") continue;
    const value = fields[field] ?? "";
    const empty = value.trim().length === 0;

    if (rule.required && empty) {
      errors.push({ field, message: `${field} is required` });
      continue;
    }
    if (!empty && rule.regex) {
      try {
        const re = new RegExp(rule.regex);
        if (!re.test(value)) {
          errors.push({ field, message: `${field} does not match the required format` });
        }
      } catch {
        console.error("Invalid validation regex for field:", field, rule.regex);
        errors.push({ field, message: `${field} has an invalid validation rule` });
      }
    }
  }
  return errors;
}

function wantsJson(c: AppContext, special: SpecialFields): boolean {
  const accept = c.req.header("Accept") || "";
  return accept.includes("application/json") || special.wantsJson;
}

function successResponse(
  c: AppContext,
  special: SpecialFields,
  form: FormRow | null,
  submissionId: string,
  plan: "free" | "pro",
  redirectTarget?: string | null,
) {
  if (wantsJson(c, special)) {
    return c.json({ success: true, submissionId });
  }

  const target =
    redirectTarget !== undefined
      ? redirectTarget
      : resolveRedirect(special.next, form?.redirect_url ?? null);

  if (target) {
    return c.redirect(target, 302);
  }

  return c.html(thankYouPage(plan === "free"), 200);
}

function validationErrorResponse(
  c: AppContext,
  special: SpecialFields,
  errors: ValidationError[],
) {
  if (wantsJson(c, special) || !acceptsHtml(c)) {
    return c.json({ success: false, errors }, 400);
  }

  const items = errors
    .map((error) => `<li><strong>${escapeHtml(error.field)}</strong>: ${escapeHtml(error.message)}</li>`)
    .join("");

  return c.html(
    page("Submission invalid", `<h1>Please fix the following</h1><ul>${items}</ul>`),
    400,
  );
}

function errorResponse(c: AppContext, special: SpecialFields, message: string, status: 400 | 429 | 500) {
  if (wantsJson(c, special) || !acceptsHtml(c)) {
    return c.json({ success: false, error: message }, status);
  }
  return c.html(page("Submission failed", `<h1>Submission failed</h1><p>${escapeHtml(message)}</p>`), status);
}

function upgradeResponse(
  c: AppContext,
  special: SpecialFields,
  message: string,
  status: 400 | 429 = 400,
) {
  if (wantsJson(c, special) || !acceptsHtml(c)) {
    return c.json({ success: false, error: message, upgradeRequired: true }, status);
  }

  const pricingUrl = `${(c.env.DASHBOARD_URL || "").replace(/\/$/, "")}/pricing`;
  return c.html(
    page(
      "Upgrade required",
      `<h1>Upgrade required</h1><p>${escapeHtml(message)}</p><p><a href="${escapeHtml(
        pricingUrl,
      )}">See FormFlux plans</a></p>`,
    ),
    status,
  );
}

function captchaErrorResponse(c: AppContext, special: SpecialFields, message: string) {
  if (wantsJson(c, special) || !acceptsHtml(c)) {
    return c.json({ success: false, error: message }, 400);
  }

  return c.html(
    page("Captcha failed", `<h1>Captcha verification failed</h1><p>${escapeHtml(message)}</p>`),
    400,
  );
}

function rateLimitResponse(
  c: AppContext,
  special: SpecialFields,
  limit: number,
  retryAfterSeconds: number,
) {
  const message = `Rate limit exceeded. This form allows ${limit} submissions per hour per IP and per form. Try again in ${retryAfterSeconds} seconds.`;
  c.header("Retry-After", String(retryAfterSeconds));

  if (wantsJson(c, special) || !acceptsHtml(c)) {
    return c.json({ success: false, error: message, retryAfterSeconds, limit }, 429);
  }

  return c.html(
    page("Too many submissions", `<h1>Too many submissions</h1><p>${escapeHtml(message)}</p>`),
    429,
  );
}

function unverifiedResponse(c: AppContext, email: string, special: SpecialFields) {
  const message = `This form is not verified yet. Check the inbox for ${email} and click the FormFlux verification link before submissions can be delivered.`;

  if (wantsJson(c, special)) {
    return c.json({ success: false, error: message }, 403);
  }

  return c.html(
    page(
      "Check your inbox",
      `<h1>Check your inbox</h1>
       <p>We sent a verification link to <strong>${escapeHtml(email)}</strong>.</p>
       <p>Click that link once, then submit this form again. Until then, submissions are not delivered.</p>`,
    ),
    403,
  );
}

function clientIp(c: AppContext): string {
  return (
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function decodeTargetEmail(encoded: string): string | null {
  const candidates = [encoded];

  try {
    candidates.push(decodeURIComponent(encoded));
  } catch {
    // ignore malformed percent-encoding
  }

  try {
    candidates.push(atob(encoded));
  } catch {
    // not base64
  }

  for (const candidate of candidates) {
    const email = candidate.trim().toLowerCase();
    if (EMAIL_RE.test(email)) return email;
  }
  return null;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isSafeRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function acceptsHtml(c: AppContext): boolean {
  return (c.req.header("Accept") || "").includes("text/html");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title: string, body: string, branding = false): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} · FormFlux</title>
    <style>
      :root { color-scheme: light; }
      body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background:#f6f5f4; color:#1c1917; }
      main { max-width: 34rem; margin: 14vh auto; background:#fff; padding:2.25rem; border-radius:1.25rem; border:1px solid #e7e5e4; box-shadow:0 12px 40px rgba(28,25,23,.06); }
      h1 { margin:0 0 .75rem; font-size:1.55rem; letter-spacing:-0.02em; }
      p, li { line-height:1.65; color:#44403c; }
      a { color:#c2410c; }
      .brand { font-size:0.72rem; letter-spacing:0.14em; text-transform:uppercase; color:#a8a29e; margin-bottom:0.9rem; font-weight:700; }
      .powered { margin-top:1.75rem; padding-top:1rem; border-top:1px solid #f5f5f4; font-size:.8rem; color:#a8a29e; }
    </style>
  </head>
  <body>
    <main>
      <div class="brand">FormFlux</div>
      ${body}
      ${branding ? `<div class="powered">Powered by <a href="/">FormFlux</a> — free plan</div>` : ""}
    </main>
  </body>
</html>`;
}

function thankYouPage(branding: boolean): string {
  return page(
    "Thanks",
    `<h1>Submission received</h1><p>Thank you. Your form was submitted successfully.</p>`,
    branding,
  );
}
