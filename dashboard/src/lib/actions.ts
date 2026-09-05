"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FREE_FORM_LIMIT, planFeatures, type Plan, type ValidationRules } from "@/lib/types";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function loadPlan(): Promise<Plan> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle();
  return (data as { plan?: string } | null)?.plan === "pro" ? "pro" : "free";
}

export async function createForm(input: { name: string; targetEmail: string }): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const name = input.name.trim();
  const targetEmail = input.targetEmail.trim().toLowerCase();
  if (!name) return { ok: false, error: "Give the form a name" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return { ok: false, error: "Enter a valid target email address" };
  }

  // Free plan is capped at one form; Pro is unlimited.
  const plan = await loadPlan();
  const features = planFeatures(plan);
  if (features.formLimit !== null) {
    const { count } = await supabase
      .from("forms")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    if ((count ?? 0) >= features.formLimit) {
      return {
        ok: false,
        error: `The free plan includes ${FREE_FORM_LIMIT} form. Upgrade to Pro for unlimited forms.`,
      };
    }
  }

  const verificationToken = crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await supabase
    .from("forms")
    .insert({
      owner_id: user.id,
      name,
      target_email: targetEmail,
      // Owners verify from the dashboard-created form the same way as zero-config.
      is_verified: targetEmail === user.email,
      verification_token: verificationToken,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/forms");
  return { ok: true, id: (data as { id: string }).id };
}

export type FormSettingsInput = {
  id: string;
  name: string;
  target_email: string;
  redirect_url: string | null;
  default_subject: string | null;
  default_cc: string | null;
  webhook_urls: string[];
  slack_webhook_url: string | null;
  discord_webhook_url: string | null;
  captcha_enabled: boolean;
  blacklist_phrases: string[];
  autoreply_enabled: boolean;
  autoreply_template: string | null;
  validation_rules: ValidationRules;
  retention_days: number;
  rate_limit_per_hour: number;
};

export async function updateFormSettings(input: FormSettingsInput): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const plan = await loadPlan();
  const features = planFeatures(plan);

  // Never silently persist Pro-only settings on a free account.
  const webhooks = features.webhooks ? input.webhook_urls : [];
  const slack = features.webhooks ? input.slack_webhook_url : null;
  const discord = features.webhooks ? input.discord_webhook_url : null;
  const autoreply = features.autoreply ? input.autoreply_enabled : false;

  const { error } = await supabase
    .from("forms")
    .update({
      name: input.name.trim() || null,
      target_email: input.target_email.trim().toLowerCase(),
      redirect_url: input.redirect_url?.trim() || null,
      default_subject: input.default_subject?.trim() || null,
      default_cc: input.default_cc?.trim() || null,
      webhook_urls: webhooks,
      slack_webhook_url: slack?.trim() || null,
      discord_webhook_url: discord?.trim() || null,
      captcha_enabled: input.captcha_enabled,
      blacklist_phrases: input.blacklist_phrases,
      autoreply_enabled: autoreply,
      autoreply_template: input.autoreply_template?.trim() || null,
      validation_rules: input.validation_rules,
      retention_days: input.retention_days,
      rate_limit_per_hour: input.rate_limit_per_hour,
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/forms/${input.id}`);
  revalidatePath("/forms");
  return { ok: true };
}

export async function deleteForm(formId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("forms").delete().eq("id", formId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/forms");
  return { ok: true };
}

export async function setSubmissionSpam(
  submissionId: string,
  isSpam: boolean,
): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("submissions")
    .update({ is_spam: isSpam })
    .eq("id", submissionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/forms");
  revalidatePath("/archive");
  return { ok: true };
}

export async function deleteSubmission(submissionId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("submissions").delete().eq("id", submissionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/forms");
  revalidatePath("/archive");
  return { ok: true };
}

/** Marks the form verified from the dashboard (owner already proved inbox access). */
export async function verifyFormFromDashboard(formId: string): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("forms")
    .select("target_email")
    .eq("id", formId)
    .maybeSingle();

  const target = (data as { target_email: string | null } | null)?.target_email;
  if (!target) return { ok: false, error: "Form has no target email" };
  if (target.toLowerCase() !== (user.email || "").toLowerCase()) {
    return {
      ok: false,
      error: "Only your own sign-in address can be verified here. Use the emailed link instead.",
    };
  }

  const { error } = await supabase.from("forms").update({ is_verified: true }).eq("id", formId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/forms/${formId}`);
  return { ok: true };
}
