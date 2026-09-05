/**
 * FormSubmit.co-compatible special fields.
 *
 * Every field below is read from the submitted body and stripped from the stored
 * payload, so owners can override form-level settings for a single submission
 * without touching their dashboard configuration.
 */

// Matching every phrase against every field is O(phrases × fields). Twenty is
// plenty for hand-written blocklists and keeps a hostile body from turning one
// submission into thousands of substring scans.
export const MAX_BLACKLIST_PHRASES = 20;

export const SPECIAL_FIELD_KEYS = [
  "_honeypot",
  "_honey",
  "_subject",
  "_cc",
  "_replyto",
  "_template",
  "_format",
  "_next",
  "_blacklist",
  "_captcha",
  "_webhook",
  "_autoresponse",
] as const;

export const CAPTCHA_RESPONSE_KEYS = ["h-captcha-response", "g-recaptcha-response"] as const;

export type SpecialFields = {
  /** Per-submission redirect target; overrides forms.redirect_url when valid. */
  next: string | null;
  /** Per-submission blocklist phrases, already trimmed, lowercased and capped. */
  blacklist: string[];
  /** True when `_captcha=false` asks us to skip hCaptcha for this submission. */
  captchaDisabled: boolean;
  /** Extra one-off webhook destination. */
  webhook: string | null;
  /** Per-submission autoreply body, overriding forms.autoreply_template. */
  autoresponse: string | null;
  subject: string | null;
  cc: string | null;
  replyTo: string | null;
  template: string | null;
  /** Whether the sender asked for a JSON response (AJAX mode). */
  wantsJson: boolean;
  /** Honeypot value from either `_honeypot` (FormFlux) or `_honey` (FormSubmit). */
  honeypot: string;
  /** Names of the special fields actually present, for the submission audit trail. */
  used: string[];
};

function firstNonEmpty(fields: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

export function parseSpecialFields(fields: Record<string, string>): SpecialFields {
  const used = SPECIAL_FIELD_KEYS.filter(
    (key) => typeof fields[key] === "string" && fields[key].trim().length > 0,
  );

  const blacklistRaw = fields._blacklist ?? "";
  const blacklist = blacklistRaw
    .split(",")
    .map((phrase) => phrase.trim().toLowerCase())
    .filter((phrase) => phrase.length > 0)
    .slice(0, MAX_BLACKLIST_PHRASES);

  // FormSubmit treats only the literal string "false" as "turn the captcha off".
  const captchaDisabled = (fields._captcha ?? "").trim().toLowerCase() === "false";

  return {
    next: firstNonEmpty(fields, ["_next"]),
    blacklist,
    captchaDisabled,
    webhook: firstNonEmpty(fields, ["_webhook"]),
    autoresponse: firstNonEmpty(fields, ["_autoresponse"]),
    subject: firstNonEmpty(fields, ["_subject"]),
    cc: firstNonEmpty(fields, ["_cc"]),
    replyTo: firstNonEmpty(fields, ["_replyto"]),
    template: firstNonEmpty(fields, ["_template"]),
    wantsJson: (fields._format ?? "").trim().toLowerCase() === "json",
    honeypot: (fields._honeypot ?? fields._honey ?? "").trim(),
    used: [...used],
  };
}

/** Fields the sender should never see echoed back into storage or email. */
export function stripSpecialFields(fields: Record<string, string>): Record<string, string> {
  const hidden = new Set<string>([
    "_honeypot",
    "_honey",
    "_blacklist",
    "_captcha",
    "_webhook",
    ...CAPTCHA_RESPONSE_KEYS,
  ]);

  const stored: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (hidden.has(key)) continue;
    stored[key] = value;
  }
  return stored;
}

/**
 * FormSubmit's `_webhook` payload shape. Kept deliberately different from the
 * richer FormFlux webhook payload so snippets copied from FormSubmit's docs work
 * without changes.
 */
export function formSubmitWebhookPayload(
  fields: Record<string, string>,
): Record<string, unknown> {
  return { form_data: stripSpecialFields(fields) };
}
