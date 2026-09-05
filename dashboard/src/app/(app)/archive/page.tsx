import { PageHeader } from "@/components/page-header";
import { ArchiveSearch } from "@/components/archive-search";
import { createClient } from "@/lib/supabase/server";
import type { FormRow } from "@/lib/types";
import { workerUrl } from "@/lib/utils";

export const metadata = { title: "Archive" };

export default async function ArchivePage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("forms")
    .select("id, name")
    .order("created_at", { ascending: false });

  const forms = (data ?? []) as Pick<FormRow, "id" | "name">[];

  return (
    <>
      <PageHeader
        title="Submission archive"
        description="Search your full history across every form, with no call limits — this is your own Supabase data, read under row-level security."
      />
      <ArchiveSearch forms={forms} workerBase={workerUrl()} />
    </>
  );
}
