import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { FormTabs } from "@/components/form-detail/form-tabs";
import { PageHeader } from "@/components/page-header";
import { CopyButton } from "@/components/ui/copy-button";
import { createClient } from "@/lib/supabase/server";
import type { FormRow, Plan } from "@/lib/types";
import { workerUrl } from "@/lib/utils";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from("forms").select("name").eq("id", params.id).maybeSingle();
  return { title: (data as { name?: string } | null)?.name || "Form" };
}

export default async function FormDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: formData }, { data: profileData }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("profiles").select("plan").eq("id", user!.id).maybeSingle(),
  ]);

  const form = formData as FormRow | null;
  if (!form) notFound();

  const plan: Plan = (profileData as { plan?: string } | null)?.plan === "pro" ? "pro" : "free";
  const endpoint = `${workerUrl()}/f/${form.id}`;

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link
            href="/forms"
            className="inline-flex items-center gap-1 transition-colors hover:text-[rgb(var(--text))]"
          >
            <ChevronLeft className="size-3.5" />
            All forms
          </Link>
        }
        title={form.name || "Untitled form"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-stone-100 px-2 py-1 font-mono text-[0.75rem] dark:bg-stone-800/60">
              {endpoint}
            </code>
            <span className="text-[0.8rem]">
              → {form.target_email || "no target email"}
            </span>
          </span>
        }
        action={
          <CopyButton value={endpoint} label="Copy endpoint" toastMessage="Endpoint URL copied" />
        }
      />

      <FormTabs
        form={form}
        plan={plan}
        workerBase={workerUrl()}
        canSelfVerify={
          (form.target_email ?? "").toLowerCase() === (user?.email ?? "").toLowerCase()
        }
      />
    </>
  );
}
