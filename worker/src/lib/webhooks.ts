import { createSupabase, type Bindings, type FormRow } from "./supabase";
import { filenameFromKey, fileDownloadUrl } from "./files";
import { visibleFields } from "./email";
import { formSubmitWebhookPayload } from "./special-fields";

/**
 * `formsubmit` mirrors FormSubmit.co's `{ form_data: {...} }` body and is used for
 * the per-submission `_webhook` field; the other kinds are FormFlux's own shapes.
 */
export type WebhookKind = "generic" | "slack" | "discord" | "formsubmit";

export type WebhookQueueMessage = {
  submissionId: string;
  formId: string | null;
  destination: string;
  kind: WebhookKind;
  attempt: number;
};

export type SubmissionWebhookContext = {
  form: FormRow;
  submissionId: string;
  createdAt: string;
  data: Record<string, string>;
  fileKeys: string[];
  origin: string;
  /** One-off destination from the submission's `_webhook` field. */
  extraWebhook?: string | null;
};

const MAX_ATTEMPTS = 5;
const RETRY_BASE_SECONDS = 60;
const RESPONSE_SNIPPET_CHARS = 300;

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function fileUrls(ctx: SubmissionWebhookContext): { filename: string; url: string }[] {
  return ctx.fileKeys.map((key) => {
    const filename = filenameFromKey(key);
    return {
      filename,
      url: fileDownloadUrl(ctx.origin, ctx.form.id, ctx.submissionId, filename),
    };
  });
}

export function genericWebhookPayload(ctx: SubmissionWebhookContext): Record<string, unknown> {
  return {
    event: "form.submission",
    formId: ctx.form.id,
    formName: ctx.form.name,
    submissionId: ctx.submissionId,
    createdAt: ctx.createdAt,
    data: visibleFields(ctx.data),
    files: fileUrls(ctx),
  };
}

export function slackWebhookPayload(ctx: SubmissionWebhookContext): Record<string, unknown> {
  const fields = Object.entries(visibleFields(ctx.data)).slice(0, 10).map(([key, value]) => ({
    type: "mrkdwn",
    text: `*${truncate(key, 40)}*\n${truncate(value || "(empty)", 280)}`,
  }));

  const fileLines = fileUrls(ctx)
    .map((file) => `<${file.url}|${file.filename}>`)
    .join("\n");

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: { type: "plain_text", text: truncate(ctx.form.name || "New form submission", 150) },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `New FormFlux submission \`${ctx.submissionId}\``,
      },
    },
  ];

  if (fields.length > 0) {
    blocks.push({ type: "section", fields });
  }
  if (fileLines) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Files*\n${fileLines}` },
    });
  }

  return {
    text: `New FormFlux submission on ${ctx.form.name || "your form"}`,
    blocks,
  };
}

export function discordWebhookPayload(ctx: SubmissionWebhookContext): Record<string, unknown> {
  const fields = Object.entries(visibleFields(ctx.data)).slice(0, 25).map(([key, value]) => ({
    name: truncate(key, 256),
    value: truncate(value || "(empty)", 1024),
    inline: true,
  }));

  const files = fileUrls(ctx);
  if (files.length > 0) {
    fields.push({
      name: "Files",
      value: truncate(files.map((file) => `[${file.filename}](${file.url})`).join("\n"), 1024),
      inline: false,
    });
  }

  return {
    username: "FormFlux",
    embeds: [
      {
        title: ctx.form.name || "New form submission",
        description: `Submission \`${ctx.submissionId}\``,
        color: 0x2563eb,
        fields,
        timestamp: ctx.createdAt,
      },
    ],
  };
}

export function buildWebhookPayload(
  kind: WebhookKind,
  ctx: SubmissionWebhookContext,
): Record<string, unknown> {
  if (kind === "slack") return slackWebhookPayload(ctx);
  if (kind === "discord") return discordWebhookPayload(ctx);
  if (kind === "formsubmit") return formSubmitWebhookPayload(ctx.data);
  return genericWebhookPayload(ctx);
}

export function sampleWebhookContext(form: FormRow, origin: string): SubmissionWebhookContext {
  return {
    form,
    submissionId: "00000000-0000-0000-0000-000000000000",
    createdAt: new Date().toISOString(),
    data: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "This is a test webhook from FormFlux.",
    },
    fileKeys: [],
    origin,
  };
}

async function logAttempt(
  env: Bindings,
  input: {
    submissionId: string | null;
    formId: string | null;
    destination: string;
    statusCode: number;
    attempt: number;
    responseSnippet: string;
    source: WebhookKind | "test";
  },
): Promise<void> {
  const supabase = createSupabase(env);
  const { error } = await supabase.from("webhook_logs").insert({
    submission_id: input.submissionId,
    form_id: input.formId,
    destination: input.destination,
    status_code: input.statusCode,
    attempt: input.attempt,
    response_snippet: input.responseSnippet.slice(0, RESPONSE_SNIPPET_CHARS),
    source: input.source,
  });
  if (error) {
    console.error("Failed to write webhook_logs:", error.message);
  }
}

export async function postWebhook(
  destination: string,
  payload: Record<string, unknown>,
): Promise<{ statusCode: number; ok: boolean; snippet: string }> {
  if (!isSafeHttpUrl(destination)) {
    return { statusCode: 0, ok: false, snippet: "Invalid webhook URL (http/https only)" };
  }

  try {
    const response = await fetch(destination, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const snippet = await response
      .text()
      .then((text) => text.slice(0, RESPONSE_SNIPPET_CHARS))
      .catch(() => "");
    return { statusCode: response.status, ok: response.ok, snippet };
  } catch (error) {
    console.error("Webhook request failed:", destination, error);
    return { statusCode: 0, ok: false, snippet: String(error).slice(0, RESPONSE_SNIPPET_CHARS) };
  }
}

function retryDelaySeconds(failedAttempt: number): number {
  // 60s, 120s, 240s, 480s between attempts 1→5.
  return RETRY_BASE_SECONDS * 2 ** (failedAttempt - 1);
}

async function enqueueRetry(env: Bindings, message: WebhookQueueMessage): Promise<void> {
  if (message.attempt >= MAX_ATTEMPTS) return;
  const next: WebhookQueueMessage = {
    ...message,
    attempt: message.attempt + 1,
  };
  const delaySeconds = retryDelaySeconds(message.attempt);
  try {
    await env.WEBHOOK_QUEUE.send(next, { delaySeconds });
  } catch (error) {
    console.error("Failed to enqueue webhook retry:", error);
  }
}

export async function deliverAndLog(
  env: Bindings,
  input: {
    submissionId: string | null;
    formId: string | null;
    destination: string;
    kind: WebhookKind;
    attempt: number;
    payload: Record<string, unknown>;
    enqueueOnFailure: boolean;
    source?: WebhookKind | "test";
  },
): Promise<{ statusCode: number; ok: boolean; snippet: string }> {
  const result = await postWebhook(input.destination, input.payload);
  await logAttempt(env, {
    submissionId: input.submissionId,
    formId: input.formId,
    destination: input.destination,
    statusCode: result.statusCode,
    attempt: input.attempt,
    responseSnippet: result.snippet,
    source: input.source ?? input.kind,
  });

  if (!result.ok && input.enqueueOnFailure && input.submissionId) {
    await enqueueRetry(env, {
      submissionId: input.submissionId,
      formId: input.formId,
      destination: input.destination,
      kind: input.kind,
      attempt: input.attempt,
    });
  }

  return result;
}

function webhookTargets(ctx: SubmissionWebhookContext): { destination: string; kind: WebhookKind }[] {
  const form = ctx.form;
  const targets: { destination: string; kind: WebhookKind }[] = [];

  for (const url of form.webhook_urls ?? []) {
    if (url?.trim()) targets.push({ destination: url.trim(), kind: "generic" });
  }
  if (form.slack_webhook_url?.trim()) {
    targets.push({ destination: form.slack_webhook_url.trim(), kind: "slack" });
  }
  if (form.discord_webhook_url?.trim()) {
    targets.push({ destination: form.discord_webhook_url.trim(), kind: "discord" });
  }
  // `_webhook` fires *in addition to* the configured destinations.
  if (ctx.extraWebhook?.trim()) {
    targets.push({ destination: ctx.extraWebhook.trim(), kind: "formsubmit" });
  }

  return targets;
}

export async function deliverSubmissionWebhooks(
  env: Bindings,
  ctx: SubmissionWebhookContext,
): Promise<void> {
  const targets = webhookTargets(ctx);
  if (targets.length === 0) return;

  await Promise.allSettled(
    targets.map((target) =>
      deliverAndLog(env, {
        submissionId: ctx.submissionId,
        formId: ctx.form.id,
        destination: target.destination,
        kind: target.kind,
        attempt: 1,
        payload: buildWebhookPayload(target.kind, ctx),
        enqueueOnFailure: true,
      }),
    ),
  );
}

export async function handleWebhookBatch(
  batch: MessageBatch<WebhookQueueMessage>,
  env: Bindings,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await retryQueuedWebhook(env, message.body);
      message.ack();
    } catch (error) {
      console.error("Webhook queue handler error:", error);
      message.ack();
    }
  }
}

async function retryQueuedWebhook(env: Bindings, body: WebhookQueueMessage): Promise<void> {
  const supabase = createSupabase(env);
  const { data: submission, error } = await supabase
    .from("submissions")
    .select("id, form_id, data, files, created_at, is_spam")
    .eq("id", body.submissionId)
    .maybeSingle();

  if (error) {
    console.error("Webhook retry failed to load submission:", error.message);
    return;
  }
  if (!submission) {
    console.warn("Webhook retry skipped; submission gone", body.submissionId);
    return;
  }

  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("*")
    .eq("id", (submission as { form_id: string }).form_id)
    .maybeSingle();

  if (formError || !form) {
    console.error("Webhook retry failed to load form:", formError?.message);
    return;
  }

  const row = submission as {
    id: string;
    data: Record<string, string>;
    files: string[] | null;
    created_at: string;
  };

  const ctx: SubmissionWebhookContext = {
    form: form as FormRow,
    submissionId: row.id,
    createdAt: row.created_at,
    data: row.data || {},
    fileKeys: row.files || [],
    origin: publicOriginFromEnv(env),
  };

  await deliverAndLog(env, {
    submissionId: body.submissionId,
    formId: body.formId ?? ctx.form.id,
    destination: body.destination,
    kind: body.kind,
    attempt: body.attempt,
    payload: buildWebhookPayload(body.kind, ctx),
    enqueueOnFailure: true,
  });
}

function publicOriginFromEnv(env: Bindings): string {
  return env.PUBLIC_BASE_URL?.replace(/\/$/, "") || "https://formflux.local";
}

export { MAX_ATTEMPTS };
