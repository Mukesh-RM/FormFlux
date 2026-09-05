import { Hono } from "hono";
import { cors } from "hono/cors";
import { submitRoutes } from "./routes/submit";
import { verifyRoutes } from "./routes/verify";
import { fileRoutes } from "./routes/files";
import { webhookRoutes } from "./routes/webhooks";
import { apiRoutes } from "./routes/api";
import { demoRoutes } from "./routes/demo";
import type { Bindings } from "./lib/supabase";
import { handleWebhookBatch, type WebhookQueueMessage } from "./lib/webhooks";
import { purgeExpiredSubmissions } from "./lib/retention";

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Accept", "Authorization"],
  }),
);

app.route("/", demoRoutes);
app.route("/", submitRoutes);
app.route("/", verifyRoutes);
app.route("/", fileRoutes);
app.route("/", webhookRoutes);
app.route("/", apiRoutes);

app.notFound((c) => c.json({ success: false, error: "Not found" }, 404));

app.onError((error, c) => {
  console.error("Unhandled error:", error);
  return c.json({ success: false, error: "Internal server error" }, 500);
});

const worker = {
  fetch: app.fetch,
  async queue(batch: MessageBatch<WebhookQueueMessage>, env: Bindings) {
    await handleWebhookBatch(batch, env);
  },
  async scheduled(_event: ScheduledEvent, env: Bindings) {
    const result = await purgeExpiredSubmissions(env);
    console.log("Retention cron finished", result);
  },
};

export default worker;
