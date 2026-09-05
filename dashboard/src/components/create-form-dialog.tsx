"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { createForm } from "@/lib/actions";
import { isValidEmail } from "@/lib/utils";

export function CreateFormDialog({
  atLimit,
  limit,
  defaultEmail,
}: {
  atLimit: boolean;
  limit: number | null;
  defaultEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState(defaultEmail);
  const [errors, setErrors] = React.useState<{ name?: string; email?: string }>({});
  const [pending, setPending] = React.useState(false);

  if (atLimit) {
    return (
      <Button asChild variant="primary">
        <Link href="/pricing">
          <Sparkles />
          Upgrade for more forms
        </Link>
      </Button>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = "Give the form a name you'll recognise";
    if (!isValidEmail(email)) nextErrors.email = "Enter a valid email address";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    const result = await createForm({ name, targetEmail: email });
    setPending(false);

    if (!result.ok) {
      toast.error("Could not create the form", { description: result.error });
      return;
    }

    toast.success("Form created", { description: "Copy the endpoint into your HTML." });
    setOpen(false);
    setName("");
    router.push(`/forms/${result.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus />
        Create form
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a form</DialogTitle>
          <DialogDescription>
            You&apos;ll get a UUID endpoint that keeps your real email address out of your page
            source.
            {limit !== null ? ` Free plan includes ${limit} form.` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Form name" htmlFor="form-name" error={errors.name}>
            <Input
              id="form-name"
              placeholder="Marketing site contact"
              value={name}
              invalid={Boolean(errors.name)}
              onChange={(event) => {
                setName(event.target.value);
                if (errors.name && event.target.value.trim()) {
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
            />
          </Field>

          <Field
            label="Send submissions to"
            htmlFor="form-email"
            error={errors.email}
            hint="Using your sign-in address skips the extra confirmation step."
          >
            <Input
              id="form-email"
              type="email"
              placeholder="you@company.com"
              value={email}
              invalid={Boolean(errors.email)}
              onChange={(event) => {
                setEmail(event.target.value);
                if (errors.email && isValidEmail(event.target.value)) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Creating…" : "Create form"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
