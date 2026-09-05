import type { FormRow } from "@/lib/types";

export type SnippetOptions = {
  endpoint: string;
  includeFile?: boolean;
  subject?: string | null;
  cc?: string | null;
  next?: string | null;
  blacklist?: string[] | null;
  captchaEnabled?: boolean;
  fields?: string[];
};

/**
 * Builds the paste-ready <form> markup shown in the dashboard and docs. It mirrors
 * the form's saved settings so an owner can copy it and get identical behaviour.
 */
export function buildSnippet(options: SnippetOptions): string {
  const lines: string[] = [];
  const fields = options.fields?.length ? options.fields : ["name", "email", "message"];

  lines.push(`<form action="${options.endpoint}" method="POST"${options.includeFile ? ' enctype="multipart/form-data"' : ""}>`);

  for (const field of fields) {
    if (field === "message") {
      lines.push(`  <textarea name="message" required></textarea>`);
    } else if (field === "email") {
      lines.push(`  <input type="email" name="email" required />`);
    } else {
      lines.push(`  <input type="text" name="${field}" required />`);
    }
  }

  if (options.includeFile) {
    lines.push(`  <input type="file" name="attachment" />`);
  }

  lines.push("");
  lines.push(`  <!-- bots fill this in; humans never see it -->`);
  lines.push(`  <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off" />`);

  if (options.subject) {
    lines.push(`  <input type="hidden" name="_subject" value="${escapeAttribute(options.subject)}" />`);
  }
  if (options.cc) {
    lines.push(`  <input type="hidden" name="_cc" value="${escapeAttribute(options.cc)}" />`);
  }
  if (options.next) {
    lines.push(`  <input type="hidden" name="_next" value="${escapeAttribute(options.next)}" />`);
  }
  if (options.blacklist?.length) {
    lines.push(
      `  <input type="hidden" name="_blacklist" value="${escapeAttribute(options.blacklist.join(", "))}" />`,
    );
  }
  if (options.captchaEnabled) {
    lines.push("");
    lines.push(`  <!-- captcha is on for this form -->`);
    lines.push(`  <div class="h-captcha" data-sitekey="YOUR_HCAPTCHA_SITEKEY"></div>`);
  }

  lines.push("");
  lines.push(`  <button type="submit">Send</button>`);
  lines.push(`</form>`);

  if (options.captchaEnabled) {
    lines.push(`<script src="https://js.hcaptcha.com/1/api.js" async defer></script>`);
  }

  return lines.join("\n");
}

export function snippetForForm(form: FormRow, workerBase: string): string {
  return buildSnippet({
    endpoint: `${workerBase.replace(/\/$/, "")}/f/${form.id}`,
    includeFile: true,
    subject: form.default_subject,
    cc: form.default_cc,
    next: form.redirect_url,
    blacklist: form.blacklist_phrases,
    captchaEnabled: form.captcha_enabled,
    fields: Object.keys(form.validation_rules ?? {}).length
      ? Object.keys(form.validation_rules ?? {})
      : undefined,
  });
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Fetch-based AJAX example used on the docs page. */
export function ajaxSnippet(endpoint: string): string {
  return `const response = await fetch("${endpoint}", {
  method: "POST",
  headers: { Accept: "application/json" },
  body: new FormData(document.querySelector("form")),
});

const result = await response.json();
// { success: true, submissionId: "..." }`;
}
