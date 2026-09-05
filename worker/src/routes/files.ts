import { Hono } from "hono";
import { safeFilename } from "../lib/files";
import type { Bindings } from "../lib/supabase";

export const fileRoutes = new Hono<{ Bindings: Bindings }>();

fileRoutes.get("/files/:formId/:submissionId/:filename{.+}", async (c) => {
  const formId = c.req.param("formId");
  const submissionId = c.req.param("submissionId");
  const filename = safeFilename(c.req.param("filename"));
  const key = `${formId}/${submissionId}/${filename}`;

  const object = await c.env.FORM_UPLOADS.get(key);
  if (!object) {
    return c.json({ success: false, error: "File not found" }, 404);
  }

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  headers.set("Cache-Control", "private, max-age=3600");
  if (object.size != null) headers.set("Content-Length", String(object.size));

  return new Response(object.body, { headers });
});
