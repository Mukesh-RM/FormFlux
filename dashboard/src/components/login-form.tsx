"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail, siteUrl } from "@/lib/utils";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/forms";

  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: siteUrl(`/auth/callback?next=${encodeURIComponent(next)}`),
      },
    });

    setPending(false);

    if (authError) {
      toast.error("Could not send the link", { description: authError.message });
      return;
    }

    setSent(true);
    toast.success("Magic link sent", { description: `Check ${email} for your sign-in link.` });
  }

  if (sent) {
    return (
      <div className="animate-fade-in space-y-3 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          <MailCheck className="size-5" />
        </div>
        <h1 className="text-base font-semibold tracking-tight">Check your inbox</h1>
        <p className="text-sm leading-relaxed text-muted">
          We sent a sign-in link to <span className="font-medium text-soft">{email}</span>. It
          expires in an hour.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setSent(false)} className="mt-1">
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field
        label="Email address"
        htmlFor="email"
        error={error}
        hint="We'll email you a one-time sign-in link."
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          invalid={Boolean(error)}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error && isValidEmail(event.target.value)) setError(null);
          }}
        />
      </Field>

      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        <Mail />
        {pending ? "Sending link…" : "Send magic link"}
      </Button>
    </form>
  );
}
