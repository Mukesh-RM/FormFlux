import { createSupabase, type Bindings } from "./supabase";

export type Plan = "free" | "pro";

/** Free tier limits. Everything above these is Pro-only. */
export const FREE_MONTHLY_SUBMISSIONS = 50;
export const FREE_FORM_LIMIT = 1;

export type PlanFeatures = {
  plan: Plan;
  fileUploads: boolean;
  webhooks: boolean;
  autoreply: boolean;
  analytics: boolean;
  customDomain: boolean;
  removeBranding: boolean;
  monthlySubmissions: number | null;
  formLimit: number | null;
};

export function planFeatures(plan: Plan): PlanFeatures {
  const pro = plan === "pro";
  return {
    plan,
    fileUploads: pro,
    webhooks: pro,
    autoreply: pro,
    analytics: pro,
    customDomain: pro,
    removeBranding: pro,
    monthlySubmissions: pro ? null : FREE_MONTHLY_SUBMISSIONS,
    formLimit: pro ? null : FREE_FORM_LIMIT,
  };
}

/**
 * Zero-config forms created through `/email/:address` have no owner yet, so they
 * fall back to `DEFAULT_PLAN` (free unless overridden, which is handy locally for
 * exercising Pro-only paths without seeding a profile row).
 */
export async function loadPlan(env: Bindings, ownerId: string | null): Promise<Plan> {
  if (!ownerId) return env.DEFAULT_PLAN === "pro" ? "pro" : "free";

  const supabase = createSupabase(env);
  const { data, error } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", ownerId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load plan; defaulting to free:", error.message);
    return "free";
  }

  return (data as { plan?: string } | null)?.plan === "pro" ? "pro" : "free";
}

export function monthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Submissions this calendar month across every form the owner has. */
export async function monthlySubmissionCount(
  env: Bindings,
  ownerId: string | null,
  fallbackFormId: string,
): Promise<number> {
  const supabase = createSupabase(env);
  let formIds = fallbackFormId ? [fallbackFormId] : [];

  if (ownerId) {
    const { data, error } = await supabase.from("forms").select("id").eq("owner_id", ownerId);
    if (error) {
      console.error("Failed to list owner forms for quota:", error.message);
    } else if (data && data.length > 0) {
      formIds = (data as { id: string }[]).map((row) => row.id);
    }
  }

  if (formIds.length === 0) return 0;

  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .in("form_id", formIds)
    .gte("created_at", monthStartIso());

  if (error) {
    console.error("Failed to count monthly submissions:", error.message);
    return 0;
  }

  return count ?? 0;
}
