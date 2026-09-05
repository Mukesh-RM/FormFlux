"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Plus, Save, Sparkles, TestTube2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SwitchRow } from "@/components/ui/switch";
import { updateFormSettings } from "@/lib/actions";
import { buildSnippet } from "@/lib/snippet";
import {
  MAX_BLACKLIST_PHRASES,
  planFeatures,
  type FormRow,
  type Plan,
  type ValidationRules,
} from "@/lib/types";
import { cn, isValidEmail, isValidUrl } from "@/lib/utils";

type RuleRow = { field: string; required: boolean; regex: string; sample: string };

type Errors = Partial<{
  target_email: string;
  redirect_url: string;
  default_cc: string;
  slack_webhook_url: string;
  discord_webhook_url: string;
  retention_days: string;
  rate_limit_per_hour: string;
  webhooks: string;
}>;

function rulesToRows(rules: ValidationRules | null): RuleRow[] {
  return Object.entries(rules ?? {}).map(([field, rule]) => ({
    field,
    required: Boolean(rule.required),
    regex: rule.regex ?? "",
    sample: "",
  }));
}

function ProLock({ plan }: { plan: Plan }) {
  if (plan === "pro") return null;
  return (
    <Badge tone="accent">
      <Sparkles className="size-3" />
      Pro
    </Badge>
  );
}

export function SettingsTab({
  form,
  plan,
  workerBase,
}: {
  form: FormRow;
  plan: Plan;
  workerBase: string;
}) {
  const router = useRouter();
  const features = planFeatures(plan);

  const [name, setName] = React.useState(form.name ?? "");
  const [targetEmail, setTargetEmail] = React.useState(form.target_email ?? "");
  const [redirectUrl, setRedirectUrl] = React.useState(form.redirect_url ?? "");
  const [subject, setSubject] = React.useState(form.default_subject ?? "");
  const [cc, setCc] = React.useState(form.default_cc ?? "");
  const [webhooks, setWebhooks] = React.useState<string[]>(form.webhook_urls ?? []);
  const [webhookDraft, setWebhookDraft] = React.useState("");
  const [slack, setSlack] = React.useState(form.slack_webhook_url ?? "");
  const [discord, setDiscord] = React.useState(form.discord_webhook_url ?? "");
  const [captcha, setCaptcha] = React.useState(form.captcha_enabled);
  const [phrases, setPhrases] = React.useState<string[]>(form.blacklist_phrases ?? []);
  const [phraseDraft, setPhraseDraft] = React.useState("");
  const [autoreply, setAutoreply] = React.useState(form.autoreply_enabled);
  const [template, setTemplate] = React.useState(
    form.autoreply_template ?? "Hi {{name}},\n\nThanks for reaching out — we got your message and will reply shortly.\n\n— The team",
  );
  const [rules, setRules] = React.useState<RuleRow[]>(rulesToRows(form.validation_rules));
  const [retention, setRetention] = React.useState(String(form.retention_days ?? 90));
  const [rateLimit, setRateLimit] = React.useState(String(form.rate_limit_per_hour ?? 100));

  const [errors, setErrors] = React.useState<Errors>({});
  const [pending, setPending] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  // Warn before leaving with unsaved edits.
  React.useEffect(() => {
    if (!dirty) return;
    function handler(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function touch<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setDirty(true);
    };
  }

  const setNameD = touch(setName);
  const setTargetEmailD = touch(setTargetEmail);
  const setRedirectUrlD = touch(setRedirectUrl);
  const setSubjectD = touch(setSubject);
  const setCcD = touch(setCc);
  const setSlackD = touch(setSlack);
  const setDiscordD = touch(setDiscord);
  const setCaptchaD = touch(setCaptcha);
  const setAutoreplyD = touch(setAutoreply);
  const setTemplateD = touch(setTemplate);
  const setRetentionD = touch(setRetention);
  const setRateLimitD = touch(setRateLimit);

  const snippet = React.useMemo(
    () =>
      buildSnippet({
        endpoint: `${workerBase}/f/${form.id}`,
        includeFile: features.fileUploads,
        subject,
        cc,
        next: redirectUrl,
        blacklist: phrases,
        captchaEnabled: captcha,
        fields: rules.length ? rules.map((rule) => rule.field).filter(Boolean) : undefined,
      }),
    [workerBase, form.id, features.fileUploads, subject, cc, redirectUrl, phrases, captcha, rules],
  );

  function validate(): Errors {
    const next: Errors = {};
    if (!isValidEmail(targetEmail)) next.target_email = "Enter a valid email address";
    if (redirectUrl && !isValidUrl(redirectUrl)) next.redirect_url = "Must be a full http(s) URL";
    if (cc && !cc.split(/[,;]/).every((part) => isValidEmail(part))) {
      next.default_cc = "Use comma-separated valid email addresses";
    }
    if (slack && !isValidUrl(slack)) next.slack_webhook_url = "Must be a full http(s) URL";
    if (discord && !isValidUrl(discord)) next.discord_webhook_url = "Must be a full http(s) URL";

    const retentionValue = Number(retention);
    if (!Number.isInteger(retentionValue) || retentionValue < 0 || retentionValue > 3650) {
      next.retention_days = "Whole number between 0 and 3650 (0 keeps forever)";
    }
    const rateValue = Number(rateLimit);
    if (!Number.isInteger(rateValue) || rateValue < 1 || rateValue > 10000) {
      next.rate_limit_per_hour = "Whole number between 1 and 10000";
    }
    return next;
  }

  async function save() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Some fields need attention", { description: "Check the highlighted fields." });
      return;
    }

    const validationRules: ValidationRules = {};
    for (const rule of rules) {
      const field = rule.field.trim();
      if (!field) continue;
      validationRules[field] = {
        required: rule.required,
        ...(rule.regex.trim() ? { regex: rule.regex.trim() } : {}),
      };
    }

    setPending(true);
    const result = await updateFormSettings({
      id: form.id,
      name,
      target_email: targetEmail,
      redirect_url: redirectUrl || null,
      default_subject: subject || null,
      default_cc: cc || null,
      webhook_urls: webhooks,
      slack_webhook_url: slack || null,
      discord_webhook_url: discord || null,
      captcha_enabled: captcha,
      blacklist_phrases: phrases,
      autoreply_enabled: autoreply,
      autoreply_template: template || null,
      validation_rules: validationRules,
      retention_days: Number(retention),
      rate_limit_per_hour: Number(rateLimit),
    });
    setPending(false);

    if (!result.ok) {
      toast.error("Could not save settings", { description: result.error });
      return;
    }

    setDirty(false);
    toast.success("Settings saved");
    router.refresh();
  }

  function addWebhook() {
    const value = webhookDraft.trim();
    if (!isValidUrl(value)) {
      setErrors((prev) => ({ ...prev, webhooks: "Enter a full http(s) URL" }));
      return;
    }
    if (webhooks.includes(value)) {
      setErrors((prev) => ({ ...prev, webhooks: "That destination is already listed" }));
      return;
    }
    setWebhooks([...webhooks, value]);
    setWebhookDraft("");
    setErrors((prev) => ({ ...prev, webhooks: undefined }));
    setDirty(true);
  }

  function addPhrase() {
    const value = phraseDraft.trim().toLowerCase();
    if (!value) return;
    if (phrases.length >= MAX_BLACKLIST_PHRASES) {
      toast.error(`Maximum ${MAX_BLACKLIST_PHRASES} phrases`);
      return;
    }
    if (phrases.includes(value)) {
      setPhraseDraft("");
      return;
    }
    setPhrases([...phrases, value]);
    setPhraseDraft("");
    setDirty(true);
  }

  const previewFields: Record<string, string> = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    message: "Do you offer annual billing?",
  };
  const templatePreview = template.replace(
    /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g,
    (_, key: string) => previewFields[key] ?? `{{${key}}}`,
  );

  return (
    <div className="space-y-6 pb-24">
      {/* Delivery */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>
            Where submissions go and what the notification email looks like.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Form name" htmlFor="name">
            <Input id="name" value={name} onChange={(event) => setNameD(event.target.value)} />
          </Field>
          <Field label="Target email" htmlFor="target-email" error={errors.target_email}>
            <Input
              id="target-email"
              type="email"
              value={targetEmail}
              invalid={Boolean(errors.target_email)}
              onChange={(event) => {
                setTargetEmailD(event.target.value);
                if (errors.target_email && isValidEmail(event.target.value)) {
                  setErrors((prev) => ({ ...prev, target_email: undefined }));
                }
              }}
            />
          </Field>
          <Field
            label="Default subject line"
            htmlFor="subject"
            hint="A submission's _subject field overrides this."
          >
            <Input
              id="subject"
              placeholder="New website enquiry"
              value={subject}
              onChange={(event) => setSubjectD(event.target.value)}
            />
          </Field>
          <Field
            label="Default CC"
            htmlFor="cc"
            error={errors.default_cc}
            hint="Comma-separated. Overridden by _cc."
          >
            <Input
              id="cc"
              placeholder="sales@company.com, ops@company.com"
              value={cc}
              invalid={Boolean(errors.default_cc)}
              onChange={(event) => {
                setCcD(event.target.value);
                setErrors((prev) => ({ ...prev, default_cc: undefined }));
              }}
            />
          </Field>
          <Field
            label="Default redirect URL"
            htmlFor="redirect"
            error={errors.redirect_url}
            hint="Where senders land after submitting. A per-submission _next field overrides this."
            className="sm:col-span-2"
          >
            <Input
              id="redirect"
              placeholder="https://example.com/thanks"
              value={redirectUrl}
              invalid={Boolean(errors.redirect_url)}
              onChange={(event) => {
                setRedirectUrlD(event.target.value);
                setErrors((prev) => ({ ...prev, redirect_url: undefined }));
              }}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Spam */}
      <Card>
        <CardHeader>
          <CardTitle>Spam protection</CardTitle>
          <CardDescription>
            Blocked submissions are stored and flagged rather than thrown away, so you can rescue
            false positives.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SwitchRow
            title="Require hCaptcha"
            description="Submissions must include a valid h-captcha-response token. A _captcha=false field skips it for one submission."
            checked={captcha}
            onCheckedChange={setCaptchaD}
          />

          <Field
            label="Blacklist phrases"
            hint={`Case-insensitive. ${phrases.length}/${MAX_BLACKLIST_PHRASES} used. Matching submissions are silently marked as spam.`}
          >
            <div className="flex gap-2">
              <Input
                placeholder="viagra"
                value={phraseDraft}
                onChange={(event) => setPhraseDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addPhrase();
                  }
                }}
              />
              <Button
                type="button"
                onClick={addPhrase}
                disabled={phrases.length >= MAX_BLACKLIST_PHRASES}
              >
                <Plus />
                Add
              </Button>
            </div>
          </Field>

          {phrases.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {phrases.map((phrase) => (
                <span
                  key={phrase}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-stone-50 px-2.5 py-1 text-[0.78rem] dark:bg-stone-800/60"
                >
                  {phrase}
                  <button
                    type="button"
                    aria-label={`Remove ${phrase}`}
                    className="text-muted transition-colors hover:text-red-600"
                    onClick={() => {
                      setPhrases(phrases.filter((item) => item !== phrase));
                      setDirty(true);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[0.8rem] text-muted">
              No phrases yet — the built-in heuristics (excessive links, known spam keywords) still
              apply.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Webhooks</CardTitle>
            <ProLock plan={plan} />
          </div>
          <CardDescription>
            Fired in parallel on every accepted submission. Failures retry with backoff up to five
            attempts.
          </CardDescription>
        </CardHeader>
        <CardContent
          className={cn("space-y-5", !features.webhooks && "pointer-events-none opacity-55")}
        >
          <Field label="JSON destinations" error={errors.webhooks}>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/hooks/formflux"
                value={webhookDraft}
                invalid={Boolean(errors.webhooks)}
                onChange={(event) => {
                  setWebhookDraft(event.target.value);
                  setErrors((prev) => ({ ...prev, webhooks: undefined }));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addWebhook();
                  }
                }}
              />
              <Button type="button" onClick={addWebhook}>
                <Plus />
                Add
              </Button>
            </div>
          </Field>

          {webhooks.length > 0 ? (
            <ul className="space-y-2">
              {webhooks.map((url) => (
                <li key={url} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-[0.78rem] text-soft">
                    {url}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${url}`}
                    className="text-muted hover:text-red-600"
                    onClick={() => {
                      setWebhooks(webhooks.filter((item) => item !== url));
                      setDirty(true);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Slack incoming webhook"
              htmlFor="slack"
              error={errors.slack_webhook_url}
              hint="Posted using Slack block format."
            >
              <Input
                id="slack"
                placeholder="https://hooks.slack.com/services/…"
                value={slack}
                invalid={Boolean(errors.slack_webhook_url)}
                onChange={(event) => {
                  setSlackD(event.target.value);
                  setErrors((prev) => ({ ...prev, slack_webhook_url: undefined }));
                }}
              />
            </Field>
            <Field
              label="Discord webhook"
              htmlFor="discord"
              error={errors.discord_webhook_url}
              hint="Posted as a rich embed."
            >
              <Input
                id="discord"
                placeholder="https://discord.com/api/webhooks/…"
                value={discord}
                invalid={Boolean(errors.discord_webhook_url)}
                onChange={(event) => {
                  setDiscordD(event.target.value);
                  setErrors((prev) => ({ ...prev, discord_webhook_url: undefined }));
                }}
              />
            </Field>
          </div>
        </CardContent>
        {!features.webhooks ? (
          <div className="border-t px-6 py-4">
            <Button asChild variant="primary" size="sm">
              <Link href="/pricing">
                <Sparkles />
                Upgrade to enable webhooks
              </Link>
            </Button>
          </div>
        ) : null}
      </Card>

      {/* Autoreply */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Autoreply</CardTitle>
            <ProLock plan={plan} />
          </div>
          <CardDescription>
            Sends a confirmation to whoever submitted, detected from an <code>email</code>,{" "}
            <code>e-mail</code>, or <code>_replyto</code> field.
          </CardDescription>
        </CardHeader>
        <CardContent
          className={cn("space-y-5", !features.autoreply && "pointer-events-none opacity-55")}
        >
          <SwitchRow
            title="Send an autoreply"
            description="A _autoresponse field on a submission overrides the template below."
            checked={autoreply}
            onCheckedChange={setAutoreplyD}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Field
              label="Template"
              htmlFor="template"
              hint="Placeholders: {{name}}, {{email}}, {{message}} — any submitted field name works."
            >
              <Textarea
                id="template"
                value={template}
                onChange={(event) => setTemplateD(event.target.value)}
                className="min-h-[11rem] font-mono text-[0.8rem]"
              />
            </Field>
            <div className="space-y-2">
              <p className="text-[0.8rem] font-semibold tracking-tight text-soft">Live preview</p>
              <div className="min-h-[11rem] whitespace-pre-wrap rounded-lg border bg-stone-50 p-3.5 text-[0.85rem] leading-relaxed text-soft dark:bg-stone-800/40">
                {templatePreview || "Nothing to preview yet."}
              </div>
            </div>
          </div>
        </CardContent>
        {!features.autoreply ? (
          <div className="border-t px-6 py-4">
            <Button asChild variant="primary" size="sm">
              <Link href="/pricing">
                <Sparkles />
                Upgrade to enable autoreply
              </Link>
            </Button>
          </div>
        ) : null}
      </Card>

      {/* Validation */}
      <Card>
        <CardHeader>
          <CardTitle>Validation rules</CardTitle>
          <CardDescription>
            Invalid submissions get a 400 with a clear error list instead of silently landing in your
            inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.length === 0 ? (
            <p className="text-[0.85rem] text-muted">
              No rules yet. Every field is accepted as-is.
            </p>
          ) : null}

          {rules.map((rule, index) => {
            let regexError: string | null = null;
            let sampleResult: boolean | null = null;
            if (rule.regex.trim()) {
              try {
                const re = new RegExp(rule.regex);
                if (rule.sample) sampleResult = re.test(rule.sample);
              } catch {
                regexError = "That is not a valid regular expression";
              }
            }

            function update(patch: Partial<RuleRow>) {
              setRules(rules.map((item, i) => (i === index ? { ...item, ...patch } : item)));
              setDirty(true);
            }

            return (
              <div key={index} className="space-y-3 rounded-xl border p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
                  <Field label="Field name">
                    <Input
                      placeholder="email"
                      value={rule.field}
                      onChange={(event) => update({ field: event.target.value })}
                    />
                  </Field>
                  <Field label="Regex (optional)" error={regexError}>
                    <Input
                      placeholder="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                      value={rule.regex}
                      invalid={Boolean(regexError)}
                      className="font-mono text-[0.8rem]"
                      onChange={(event) => update({ regex: event.target.value })}
                    />
                  </Field>
                  <div className="flex items-end gap-2 pb-1">
                    <label className="flex cursor-pointer select-none items-center gap-2 text-[0.8rem] font-medium text-soft">
                      <input
                        type="checkbox"
                        checked={rule.required}
                        onChange={(event) => update({ required: event.target.checked })}
                        className="size-4 accent-accent-600"
                      />
                      Required
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove rule"
                      className="text-muted hover:text-red-600"
                      onClick={() => {
                        setRules(rules.filter((_, i) => i !== index));
                        setDirty(true);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <TestTube2 className="size-3.5 text-muted" />
                  <Input
                    placeholder="Test a sample value"
                    value={rule.sample}
                    onChange={(event) => update({ sample: event.target.value })}
                    className="h-8 max-w-xs text-[0.8rem]"
                  />
                  {rule.sample && sampleResult !== null ? (
                    <Badge tone={sampleResult ? "success" : "danger"}>
                      {sampleResult ? (
                        <>
                          <Check className="size-3" />
                          Passes
                        </>
                      ) : (
                        <>
                          <X className="size-3" />
                          Fails
                        </>
                      )}
                    </Badge>
                  ) : null}
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            onClick={() => {
              setRules([...rules, { field: "", required: true, regex: "", sample: "" }]);
              setDirty(true);
            }}
          >
            <Plus />
            Add rule
          </Button>
        </CardContent>
      </Card>

      {/* Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Retention &amp; limits</CardTitle>
          <CardDescription>
            A daily job deletes submissions past the retention window, including their uploaded
            files.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Retention (days)"
            htmlFor="retention"
            error={errors.retention_days}
            hint="0 keeps submissions forever."
          >
            <Input
              id="retention"
              type="number"
              min={0}
              max={3650}
              value={retention}
              invalid={Boolean(errors.retention_days)}
              onChange={(event) => {
                setRetentionD(event.target.value);
                setErrors((prev) => ({ ...prev, retention_days: undefined }));
              }}
            />
          </Field>
          <Field
            label="Rate limit (per hour)"
            htmlFor="rate"
            error={errors.rate_limit_per_hour}
            hint="Counted per IP and per form in a rolling hour."
          >
            <Input
              id="rate"
              type="number"
              min={1}
              max={10000}
              value={rateLimit}
              invalid={Boolean(errors.rate_limit_per_hour)}
              onChange={(event) => {
                setRateLimitD(event.target.value);
                setErrors((prev) => ({ ...prev, rate_limit_per_hour: undefined }));
              }}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Snippet */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Copy this HTML</CardTitle>
              <CardDescription>
                Always in sync with the settings above. The UUID endpoint keeps your email address
                out of your page source.
              </CardDescription>
            </div>
            <CopyButton value={snippet} label="Copy HTML" toastMessage="Form HTML copied" />
          </div>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-xl bg-stone-900 p-4 font-mono text-[0.76rem] leading-relaxed text-stone-100">
            {snippet}
          </pre>
        </CardContent>
      </Card>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-20">
        <div
          className={cn(
            "panel flex items-center justify-between gap-4 rounded-xl px-4 py-3 shadow-pop transition-opacity",
            dirty ? "opacity-100" : "opacity-95",
          )}
        >
          <p className="text-[0.82rem] text-muted">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <Button variant="primary" onClick={save} disabled={pending || !dirty}>
            <Save />
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
