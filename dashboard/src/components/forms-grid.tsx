"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MailWarning, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateFormDialog } from "@/components/create-form-dialog";
import { deleteForm } from "@/lib/actions";
import type { FormRow } from "@/lib/types";

export function FormsGrid({
  forms,
  counts,
  workerBase,
  defaultEmail,
}: {
  forms: FormRow[];
  counts: Record<string, { total: number; spam: number }>;
  workerBase: string;
  defaultEmail: string;
}) {
  const router = useRouter();

  if (forms.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="size-5" />}
        title="No forms yet"
        description="FormFlux gives every form a URL. You paste that URL into your HTML form's action attribute — no JavaScript, no server, no API keys in your markup."
        action={<CreateFormDialog atLimit={false} limit={null} defaultEmail={defaultEmail} />}
      >
        <ol className="space-y-3 text-sm text-soft">
          {[
            "Create a form and pick where submissions should be emailed.",
            "Copy the generated endpoint into your <form action=\"…\">.",
            "Submit once to confirm the inbox, then you're live.",
          ].map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-100 text-[0.7rem] font-bold text-accent-700 dark:bg-accent-950 dark:text-accent-300">
                {index + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {forms.map((form) => {
        const endpoint = `${workerBase}/f/${form.id}`;
        const stats = counts[form.id] ?? { total: 0, spam: 0 };

        return (
          <Card
            key={form.id}
            className="group flex flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/forms/${form.id}`}
                  className="block truncate text-[0.98rem] font-semibold tracking-tight hover:text-accent-600 dark:hover:text-accent-400"
                >
                  {form.name || "Untitled form"}
                </Link>
                <p className="mt-0.5 truncate text-[0.8rem] text-muted">
                  {form.target_email || "No target email"}
                </p>
              </div>
              {form.is_verified ? (
                <Badge tone="success">
                  <ShieldCheck className="size-3" />
                  Verified
                </Badge>
              ) : (
                <Badge tone="warning">
                  <MailWarning className="size-3" />
                  Unverified
                </Badge>
              )}
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <dt className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
                  This month
                </dt>
                <dd className="mt-1 text-xl font-bold tracking-tight">{stats.total}</dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
                  Spam caught
                </dt>
                <dd className="mt-1 text-xl font-bold tracking-tight">{stats.spam}</dd>
              </div>
            </dl>

            <code className="mt-4 block truncate rounded-lg bg-stone-100 px-2.5 py-2 font-mono text-[0.72rem] text-muted dark:bg-stone-800/60">
              {endpoint}
            </code>

            <div className="mt-4 flex items-center gap-2 border-t pt-4">
              <CopyButton
                value={endpoint}
                label="Copy endpoint"
                toastMessage="Endpoint URL copied"
                className="flex-1"
              />
              <Button asChild variant="ghost" size="icon" aria-label="Open form">
                <Link href={`/forms/${form.id}`}>
                  <ArrowUpRight />
                </Link>
              </Button>
              <ConfirmDialog
                title={`Delete "${form.name || "this form"}"?`}
                description="This permanently removes the form, its submissions, and its webhook logs. Anything already pointing at this endpoint will start failing."
                confirmLabel="Delete form"
                onConfirm={async () => {
                  const result = await deleteForm(form.id);
                  if (result.ok) {
                    toast.success("Form deleted");
                    router.refresh();
                  } else {
                    toast.error("Could not delete form", { description: result.error });
                  }
                }}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete form"
                    className="text-muted hover:text-red-600"
                  >
                    <Trash2 />
                  </Button>
                }
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
