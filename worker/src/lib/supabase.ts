import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL?: string;
  HCAPTCHA_SECRET?: string;
  PUBLIC_BASE_URL?: string;
  DASHBOARD_URL?: string;
  /** Plan applied to forms with no owner yet (zero-config). "free" by default. */
  DEFAULT_PLAN?: string;
  RATE_LIMIT_KV: KVNamespace;
  FORM_UPLOADS: R2Bucket;
  WEBHOOK_QUEUE: Queue;
};

export type FieldRule = {
  required?: boolean;
  regex?: string;
};

export type ValidationRules = Record<string, FieldRule>;

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
  blacklist_phrases: string[] | null;
  webhook_urls: string[] | null;
  slack_webhook_url: string | null;
  discord_webhook_url: string | null;
  captcha_enabled: boolean;
  autoreply_enabled: boolean;
  autoreply_template: string | null;
  validation_rules: ValidationRules | null;
  retention_days: number;
  rate_limit_per_hour: number;
  created_at: string;
};

export function createSupabase(env: Bindings): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
