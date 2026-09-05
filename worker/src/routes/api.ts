import { Hono } from "hono";
import { authenticate } from "../lib/auth";
import { fromAddress, sendSubmissionEmail } from "../lib/email";
import { fileDownloadUrl, publicOrigin } from "../lib/files";
import { loadPlan, monthlySubmissionCount, planFeatures } from "../lib/plan";
import { createSupabase, type Bindings, type FormRow } from "../lib/supabase";

type SubmissionRow = {
  id: string;
  form_id: string;
  data: Record<string, string>;
  files: string[] | null;
  is_spam: boolean;
  delivered: boolean;
  created_at: string;
};

export const apiRoutes = new Hono<{ Bindings: Bindings }>();

/** Plan + usage summary for the dashboard header and upgrade prompts. */
apiRoutes.get("/api/me", async (c) => {
  const user = await authenticate(c);
  if (!user) return c.json({ success: false, error: "Unauthorized" }, 401);

  const plan = await loadPlan(c.env, user.id);
  const features = planFeatures(plan);
  const used = await monthlySubmissionCount(c.env, user.id, "");

  return c.json({
    success: true,
    user: { id: user.id, email: user.email },
    plan,
    features,
    usage: { submissionsThisMonth: used },
  });
});

/**
 * Re-send the owner notification for one submission. Used after an owner marks a
 * false-positive spam submission as legitimate.
 */
apiRoutes.post("/api/submissions/:id/resend", async (c) => {
  const user = await authenticate(c);
  if (!user) return c.json({ success: false, error: "Unauthorized" }, 401);

  const supabase = createSupabase(c.env);
  const submissionId = c.req.param("id");
  const { data: submissionData, error } = await supabase
    .from("submissions")
    .select("id, form_id, data, files, is_spam, delivered, created_at")
    .eq("id", submissionId)
    .maybeSingle();

  if (error) {
    console.error("Resend failed to load submission:", error.message);
    return c.json({ success: false, error: "Unable to load submission" }, 500);
  }
  const submission = submissionData as SubmissionRow | null;
  if (!submission) return c.json({ success: false, error: "Submission not found" }, 404);

  const { data: formData } = await supabase
    .from("forms")
    .select("*")
    .eq("id", submission.form_id)
    .maybeSingle();
  const form = formData as FormRow | null;

  if (!form || form.owner_id !== user.id) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }
  if (!form.target_email) {
    return c.json({ success: false, error: "This form has no target email set" }, 400);
  }

  const origin = publicOrigin(c.env.PUBLIC_BASE_URL, c.req.url);
  const fileLinks = (submission.files ?? []).map((key) => {
    const filename = key.split("/").pop() || key;
    return { filename, url: fileDownloadUrl(origin, form.id, submission.id, filename) };
  });

  const result = await sendSubmissionEmail({
    apiKey: c.env.RESEND_API_KEY,
    from: fromAddress(c.env.RESEND_FROM_EMAIL),
    to: form.target_email,
    data: submission.data ?? {},
    fileLinks,
    subject: form.default_subject,
    cc: form.default_cc,
  });

  if (!result.delivered) {
    return c.json({ success: false, error: result.error || "Resend failed" }, 502);
  }

  await supabase.from("submissions").update({ delivered: true }).eq("id", submission.id);
  return c.json({ success: true, to: form.target_email });
});

/** Toggle the spam flag on a submission (false-positive recovery). */
apiRoutes.post("/api/submissions/:id/spam", async (c) => {
  const user = await authenticate(c);
  if (!user) return c.json({ success: false, error: "Unauthorized" }, 401);

  let body: { isSpam?: boolean } = {};
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ success: false, error: "JSON body required: { isSpam }" }, 400);
  }
  if (typeof body.isSpam !== "boolean") {
    return c.json({ success: false, error: "isSpam must be a boolean" }, 400);
  }

  const supabase = createSupabase(c.env);
  const submissionId = c.req.param("id");
  const { data: submissionData } = await supabase
    .from("submissions")
    .select("id, form_id")
    .eq("id", submissionId)
    .maybeSingle();
  const submission = submissionData as { id: string; form_id: string } | null;
  if (!submission) return c.json({ success: false, error: "Submission not found" }, 404);

  const { data: formData } = await supabase
    .from("forms")
    .select("owner_id")
    .eq("id", submission.form_id)
    .maybeSingle();
  if ((formData as { owner_id: string | null } | null)?.owner_id !== user.id) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }

  const { error: updateError } = await supabase
    .from("submissions")
    .update({ is_spam: body.isSpam })
    .eq("id", submission.id);

  if (updateError) {
    console.error("Failed to update spam flag:", updateError.message);
    return c.json({ success: false, error: "Unable to update submission" }, 500);
  }

  return c.json({ success: true, isSpam: body.isSpam });
});
