"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { isValidEmail, workerUrl } from "@/lib/utils";

type State = "idle" | "sending" | "done" | "error";

/**
 * A real submission against the Worker's live demo endpoint. It runs the actual
 * honeypot and spam checks and returns JSON; nothing is stored or emailed.
 */
export function DemoForm() {
  const [state, setState] = React.useState<State>("idle");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<{ submissionId?: string } | null>(null);
  const [values, setValues] = React.useState({ name: "", email: "", message: "" });

  function update(key: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!values.name.trim()) nextErrors.name = "Tell us your name";
    if (!isValidEmail(values.email)) nextErrors.email = "Enter a valid email address";
    if (!values.message.trim()) nextErrors.message = "Add a short message";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setState("sending");

    try {
      const body = new FormData();
      body.set("name", values.name);
      body.set("email", values.email);
      body.set("message", values.message);
      body.set("_format", "json");

      const response = await fetch(workerUrl("/demo/submit"), {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
      });
      const payload = (await response.json()) as { success?: boolean; submissionId?: string };

      if (!payload.success) throw new Error("rejected");
      setResult(payload);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="animate-fade-in space-y-3 py-6 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          <CheckCircle2 className="size-5" />
        </div>
        <h3 className="text-base font-semibold tracking-tight">That was a real submission</h3>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">
          FormFlux accepted it and replied with JSON. On a real form this would have landed in your
          inbox, hit your webhooks, and appeared in your dashboard.
        </p>
        {result?.submissionId ? (
          <code className="inline-block rounded-md bg-stone-100 px-2 py-1 font-mono text-[0.72rem] text-muted dark:bg-stone-800/60">
            {result.submissionId}
          </code>
        ) : null}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setState("idle");
              setValues({ name: "", email: "", message: "" });
            }}
          >
            Send another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="demo-name" error={errors.name}>
          <Input
            id="demo-name"
            value={values.name}
            invalid={Boolean(errors.name)}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Ada Lovelace"
          />
        </Field>
        <Field label="Email" htmlFor="demo-email" error={errors.email}>
          <Input
            id="demo-email"
            type="email"
            value={values.email}
            invalid={Boolean(errors.email)}
            onChange={(event) => update("email", event.target.value)}
            placeholder="ada@example.com"
          />
        </Field>
      </div>
      <Field label="Message" htmlFor="demo-message" error={errors.message}>
        <Textarea
          id="demo-message"
          value={values.message}
          invalid={Boolean(errors.message)}
          onChange={(event) => update("message", event.target.value)}
          placeholder="Does FormFlux handle file uploads?"
          className="min-h-[6rem]"
        />
      </Field>

      {/* The same honeypot FormFlux ships in its snippets. */}
      <input type="text" name="_honey" tabIndex={-1} autoComplete="off" className="hidden" />

      {state === "error" ? (
        <p className="text-[0.8rem] font-medium text-red-600 dark:text-red-400">
          Could not reach the demo endpoint. Start the Worker with <code>npm run dev</code> in{" "}
          <code>worker/</code>, or set <code>NEXT_PUBLIC_WORKER_URL</code>.
        </p>
      ) : null}

      <Button type="submit" variant="primary" className="w-full" disabled={state === "sending"}>
        {state === "sending" ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {state === "sending" ? "Sending…" : "Send this for real"}
      </Button>
      <p className="text-center text-[0.75rem] text-muted">
        Live endpoint. Nothing is stored and no email is sent.
      </p>
    </form>
  );
}
