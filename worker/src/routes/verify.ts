import { Hono } from "hono";
import { createSupabase, type Bindings, type FormRow } from "../lib/supabase";

export const verifyRoutes = new Hono<{ Bindings: Bindings }>();

verifyRoutes.get("/verify/:token", async (c) => {
  const token = c.req.param("token");
  if (!token) {
    return c.html(verifyPage("Invalid link", "<h1>Invalid verification link</h1>"), 400);
  }

  const supabase = createSupabase(c.env);
  const { data: form, error } = await supabase
    .from("forms")
    .select("*")
    .eq("verification_token", token)
    .maybeSingle<FormRow>();

  if (error) {
    console.error("Failed to look up verification token:", error.message);
    return c.html(
      verifyPage("Verification failed", "<h1>Verification failed</h1><p>Please try again later.</p>"),
      500,
    );
  }

  if (!form) {
    return c.html(
      verifyPage(
        "Link expired",
        "<h1>This link is invalid</h1><p>The verification token was not found. Request a new submission to get another email.</p>",
      ),
      404,
    );
  }

  if (!form.is_verified) {
    const { error: updateError } = await supabase
      .from("forms")
      .update({ is_verified: true })
      .eq("id", form.id);

    if (updateError) {
      console.error("Failed to mark form verified:", updateError.message);
      return c.html(
        verifyPage("Verification failed", "<h1>Verification failed</h1><p>Please try again later.</p>"),
        500,
      );
    }
  }

  return c.redirect("/verified", 302);
});

verifyRoutes.get("/verified", (c) => {
  return c.html(
    verifyPage(
      "Email verified",
      `<h1>You are verified</h1>
       <p>This inbox will now receive FormFlux submissions. You can close this tab and submit your form again.</p>`,
    ),
    200,
  );
});

function verifyPage(title: string, body: string): string {
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
      p { line-height:1.6; color:#334155; }
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
