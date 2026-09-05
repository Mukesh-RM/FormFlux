export type Plan = "free" | "pro";

export type Profile = {
  id: string;
  email: string;
  plan: Plan;
  created_at: string;
};

export type ValidationRule = {
  required?: boolean;
  regex?: string;
};

export type ValidationRules = Record<string, ValidationRule>;

export type FormRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
  target_email: string | null;
  is_verified: boolean;
  verification_token: string | null;
  redirect_url: string | null;
  default_subject: string | null;
  default_cc: string | null;
  webhook_urls: string[] | null;
  slack_webhook_url: string | null;
  discord_webhook_url: string | null;
  captcha_enabled: boolean;
  blacklist_phrases: string[] | null;
  autoreply_enabled: boolean;
  autoreply_template: string | null;
  validation_rules: ValidationRules | null;
  retention_days: number;
  rate_limit_per_hour: number;
  created_at: string;
};

export type SubmissionMeta = {
  specialFields?: string[];
  captcha?: "not_required" | "passed" | "skipped_by_field";
  spamReasons?: string[];
  redirect?: string | null;
  plan?: Plan;
  extraWebhook?: string | null;
  fileCount?: number;
};

export type SubmissionRow = {
  id: string;
  form_id: string;
  data: Record<string, string>;
  files: string[] | null;
  ip_address: string | null;
  is_spam: boolean;
  delivered: boolean;
  meta: SubmissionMeta | null;
  /** Generated column: the payload as text, used for search. */
  search_text?: string | null;
  created_at: string;
};

export type WebhookLogRow = {
  id: string;
  submission_id: string | null;
  destination: string | null;
  status_code: number | null;
  attempt: number | null;
  response_snippet: string | null;
  source: string | null;
  created_at: string;
};

export const FREE_MONTHLY_SUBMISSIONS = 50;
export const FREE_FORM_LIMIT = 1;
export const MAX_BLACKLIST_PHRASES = 20;

export type PlanFeatures = {
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
