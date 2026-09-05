import { createClient } from "@/lib/supabase/server";
import { FormsGrid } from "@/components/forms-grid";
import { PageHeader } from "@/components/page-header";
import { CreateFormDialog } from "@/components/create-form-dialog";
import { planFeatures, type FormRow, type Plan } from "@/lib/types";
import { workerUrl } from "@/lib/utils";

export const metadata = { title: "Forms" };

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export default async function FormsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: formsData }, { data: profileData }] = await Promise.all([
    supabase.from("forms").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("plan").eq("id", user!.id).maybeSingle(),
  ]);

  const forms = (formsData ?? []) as FormRow[];
  const plan: Plan = (profileData as { plan?: string } | null)?.plan === "pro" ? "pro" : "free";
  const features = planFeatures(plan);

  // One query for the month, tallied per form — cheaper than a count per card.
  const { data: monthRows } = await supabase
    .from("submissions")
    .select("form_id, is_spam")
    .gte("created_at", monthStartIso());

  const counts = new Map<string, { total: number; spam: number }>();
  for (const row of (monthRows ?? []) as { form_id: string; is_spam: boolean }[]) {
    const entry = counts.get(row.form_id) ?? { total: 0, spam: 0 };
    entry.total += 1;
    if (row.is_spam) entry.spam += 1;
    counts.set(row.form_id, entry);
  }

  const atFormLimit = features.formLimit !== null && forms.length >= features.formLimit;

  return (
    <>
      <PageHeader
        title="Your forms"
        description="Each form is an endpoint. Point any HTML form at it and FormFlux handles email, spam, files, and webhooks."
        action={
          <CreateFormDialog
            atLimit={atFormLimit}
            limit={features.formLimit}
            defaultEmail={user?.email ?? ""}
          />
        }
      />

      <FormsGrid
        forms={forms}
        counts={Object.fromEntries(counts)}
        workerBase={workerUrl()}
        defaultEmail={user?.email ?? ""}
      />
    </>
  );
}
