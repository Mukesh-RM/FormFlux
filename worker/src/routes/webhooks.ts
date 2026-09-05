import { Hono } from "hono";
import { authenticate } from "../lib/auth";
import { createSupabase, type Bindings, type FormRow } from "../lib/supabase";
import {
  buildWebhookPayload,
  deliverAndLog,
  sampleWebhookContext,
  type WebhookKind,
} from "../lib/webhooks";
import { publicOrigin } from "../lib/files";

const KINDS = new Set<WebhookKind>(["generic", "slack", "discord", "formsubmit"]);

export const webhookRoutes = new Hono<{ Bindings: Bindings }>();

webhookRoutes.post("/api/forms/:id/test-webhook", async (c) => {
  const formId = c.req.param("id");
  const supabase = createSupabase(c.env);
  const { data, error } = await supabase.from("forms").select("*").eq("id", formId).maybeSingle();

  if (error) {
    console.error("Failed to load form for test webhook:", error.message);
    return c.json({ success: false, error: "Unable to load form" }, 500);
  }

  const form = data as FormRow | null;
  if (!form) {
    return c.json({ success: false, error: "Form not found" }, 404);
  }

  // Owned forms require the dashboard's Supabase token; unclaimed zero-config
  // forms stay open so the local demo and curl examples keep working.
  if (form.owner_id) {
    const user = await authenticate(c);
    if (!user) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (user.id !== form.owner_id) return c.json({ success: false, error: "Forbidden" }, 403);
  }

  let body: { destination?: string; type?: string; url?: string } = {};
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ success: false, error: "JSON body required: { destination, type }" }, 400);
  }

  const destination = (body.destination || body.url || "").trim();
  if (!destination) {
    return c.json({ success: false, error: "destination is required" }, 400);
  }

  const kind = (body.type || "generic").trim().toLowerCase() as WebhookKind;
  if (!KINDS.has(kind)) {
    return c.json(
      { success: false, error: "type must be generic, slack, discord, or formsubmit" },
      400,
    );
  }

  const origin = publicOrigin(c.env.PUBLIC_BASE_URL, c.req.url);
  const ctx = sampleWebhookContext(form, origin);
  const payload = buildWebhookPayload(kind, ctx);
  const result = await deliverAndLog(c.env, {
    submissionId: null,
    formId: form.id,
    destination,
    kind,
    attempt: 1,
    payload,
    enqueueOnFailure: false,
    source: "test",
  });

  return c.json(
    {
      success: result.ok,
      statusCode: result.statusCode,
      destination,
      type: kind,
      response: result.snippet,
    },
    result.ok ? 200 : 502,
  );
});
