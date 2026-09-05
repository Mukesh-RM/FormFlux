const SPECIAL_FIELD_PREFIX = "_";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function visibleFields(data: Record<string, string>): Record<string, string> {
  const visible: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(SPECIAL_FIELD_PREFIX)) continue;
    if (key === "h-captcha-response" || key === "g-recaptcha-response") continue;
    visible[key] = value;
  }
  return visible;
}

function filesHtml(fileLinks: { filename: string; url: string }[]): string {
  if (fileLinks.length === 0) return "";
  const items = fileLinks
    .map(
      (file) =>
        `<li style="margin:0 0 8px;"><a href="${escapeHtml(file.url)}" style="color:#2563eb;">${escapeHtml(file.filename)}</a></li>`,
    )
    .join("");
  return `
    <tr>
      <td style="padding:20px 28px;border-top:1px solid #e2e8f0;">
        <div style="font-weight:700;margin-bottom:8px;color:#0f172a;">Uploaded files</div>
        <ul style="margin:0;padding-left:18px;color:#334155;">${items}</ul>
      </td>
    </tr>`;
}

function filesText(fileLinks: { filename: string; url: string }[]): string {
  if (fileLinks.length === 0) return "";
  return `\n\nFiles:\n${fileLinks.map((file) => `- ${file.filename}: ${file.url}`).join("\n")}`;
}

function rowsHtml(data: Record<string, string>): string {
  const entries = Object.entries(visibleFields(data));
  if (entries.length === 0) {
    return `<tr><td colspan="2" style="padding:12px 16px;color:#64748b;">No fields submitted.</td></tr>`;
  }

  return entries
    .map(
      ([key, value], index) => `
        <tr style="background:${index % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="padding:12px 16px;font-weight:600;color:#0f172a;vertical-align:top;white-space:nowrap;">${escapeHtml(key)}</td>
          <td style="padding:12px 16px;color:#334155;white-space:pre-wrap;word-break:break-word;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");
}

function tableTemplate(
  data: Record<string, string>,
  fileLinks: { filename: string; url: string }[] = [],
): { html: string; text: string } {
  const html = `
    <div style="margin:0;padding:0;background:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
              <tr>
                <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
                  <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.75;">FormFlux</div>
                  <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;">New form submission</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:0;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                    ${rowsHtml(data)}
                  </table>
                </td>
              </tr>
              ${filesHtml(fileLinks)}
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { html, text: plainText(data) + filesText(fileLinks) };
}

function plainText(data: Record<string, string>): string {
  const entries = Object.entries(visibleFields(data));
  if (entries.length === 0) return "No fields submitted.";
  return entries.map(([key, value]) => `${key}: ${value}`).join("\n");
}

function plainTemplate(
  data: Record<string, string>,
  fileLinks: { filename: string; url: string }[] = [],
): { html: string; text: string } {
  const text = plainText(data) + filesText(fileLinks);
  const html = `
    <div style="margin:0;padding:24px;background:#ffffff;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;">
      <h1 style="font-size:20px;margin:0 0 16px;">New form submission</h1>
      <pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;line-height:1.6;margin:0;">${escapeHtml(text)}</pre>
    </div>
  `;
  return { html, text };
}

export type SubmissionEmailInput = {
  apiKey: string;
  from: string;
  to: string;
  data: Record<string, string>;
  fileLinks?: { filename: string; url: string }[];
  /** Resolved from `_subject` → form default → fallback, by the caller. */
  subject?: string | null;
  /** Resolved from `_cc` → form default. Comma or semicolon separated. */
  cc?: string | null;
  replyTo?: string | null;
  template?: string | null;
};

export type VerificationEmailInput = {
  apiKey: string;
  from: string;
  to: string;
  verifyUrl: string;
};

async function sendResend(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ id?: string; error?: string }> {
  if (!apiKey) {
    return { error: "RESEND_API_KEY is not set" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    return {
      error: body.error?.message || body.message || `Resend error ${response.status}`,
    };
  }

  return { id: body.id };
}

export async function sendSubmissionEmail(
  input: SubmissionEmailInput,
): Promise<{ delivered: boolean; error?: string }> {
  const subject = input.subject?.trim() || input.data._subject?.trim() || "New FormFlux submission";
  const ccRaw = input.cc?.trim() || input.data._cc?.trim();
  const replyTo = input.replyTo?.trim() || input.data._replyto?.trim();
  const fileLinks = input.fileLinks ?? [];
  // FormSubmit ships "table", "basic" and "box" template names; "basic" is their
  // plain-text layout, so we accept both vocabularies.
  const template = (input.template || input.data._template || "table").trim().toLowerCase();
  const usePlain = template === "plain" || template === "basic" || template === "text";
  const content = usePlain
    ? plainTemplate(input.data, fileLinks)
    : tableTemplate(input.data, fileLinks);

  const payload: Record<string, unknown> = {
    from: input.from,
    to: [input.to],
    subject,
    html: content.html,
    text: content.text,
  };

  if (ccRaw) {
    payload.cc = ccRaw.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
  }
  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const result = await sendResend(input.apiKey, payload);
  if (result.error) {
    console.error("Failed to send submission email:", result.error);
    return { delivered: false, error: result.error };
  }
  return { delivered: true };
}

export async function sendVerificationEmail(
  input: VerificationEmailInput,
): Promise<{ sent: boolean; error?: string }> {
  const html = `
    <div style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center">
            <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
              <tr>
                <td style="padding:24px 28px;background:#0f172a;color:#ffffff;">
                  <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.75;">FormFlux</div>
                  <h1 style="margin:8px 0 0;font-size:22px;">Confirm your form</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:28px;color:#334155;font-size:16px;line-height:1.6;">
                  <p style="margin:0 0 16px;">Someone just pointed a form at this inbox. Click the button below to start receiving submissions.</p>
                  <p style="margin:0 0 24px;">
                    <a href="${escapeHtml(input.verifyUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">Verify email</a>
                  </p>
                  <p style="margin:0;font-size:13px;color:#64748b;">If the button does not work, paste this URL into your browser:<br>${escapeHtml(input.verifyUrl)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  const result = await sendResend(input.apiKey, {
    from: input.from,
    to: [input.to],
    subject: "Verify your FormFlux form",
    html,
    text: `Confirm your FormFlux form by visiting: ${input.verifyUrl}`,
  });

  if (result.error) {
    console.error("Failed to send verification email:", result.error);
    return { sent: false, error: result.error };
  }
  return { sent: true };
}

export function fromAddress(envFrom?: string): string {
  return envFrom?.trim() || "FormFlux <beth.t@example.com>";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const EMAIL_FIELD_NAMES = new Set(["email", "e-mail", "e_mail", "_replyto", "replyto", "reply-to"]);

export function detectSubmitterEmail(fields: Record<string, string>): string | null {
  for (const [key, value] of Object.entries(fields)) {
    if (!EMAIL_FIELD_NAMES.has(key.trim().toLowerCase())) continue;
    const email = value.trim();
    if (EMAIL_RE.test(email)) return email;
  }
  return null;
}

export function renderTemplate(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, name: string) => fields[name] ?? "");
}

const DEFAULT_AUTOREPLY =
  "Thanks for your submission. We received your message and will be in touch shortly.";

export async function sendAutoreplyEmail(input: {
  apiKey: string;
  from: string;
  fields: Record<string, string>;
  template: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const to = detectSubmitterEmail(input.fields);
  if (!to) {
    console.warn("Autoreply skipped; no submitter email field found");
    return { sent: false, error: "No submitter email" };
  }

  const source = input.template?.trim() || DEFAULT_AUTOREPLY;
  const text = renderTemplate(source, input.fields);
  const html = `
    <div style="margin:0;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;line-height:1.6;white-space:pre-wrap;">
      ${escapeHtml(text)}
    </div>
  `;

  const result = await sendResend(input.apiKey, {
    from: input.from,
    to: [to],
    subject: input.fields._subject?.trim() ? `Re: ${input.fields._subject.trim()}` : "We received your submission",
    html,
    text,
  });

  if (result.error) {
    console.error("Failed to send autoreply:", result.error);
    return { sent: false, error: result.error };
  }
  return { sent: true };
}
