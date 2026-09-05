import { createSupabase, type Bindings } from "./supabase";
import { deleteStoredFiles } from "./files";

export async function purgeExpiredSubmissions(env: Bindings): Promise<{ deleted: number }> {
  const supabase = createSupabase(env);
  const { data: forms, error } = await supabase.from("forms").select("id, retention_days");

  if (error) {
    console.error("Retention job failed to list forms:", error.message);
    return { deleted: 0 };
  }

  let deleted = 0;
  const now = Date.now();

  for (const form of forms ?? []) {
    const days = (form as { id: string; retention_days: number | null }).retention_days;
    if (typeof days !== "number" || days <= 0) continue;

    const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
    const formId = (form as { id: string }).id;

    const { data: expired, error: selectError } = await supabase
      .from("submissions")
      .select("id, files")
      .eq("form_id", formId)
      .lt("created_at", cutoff);

    if (selectError) {
      console.error("Retention job failed to list submissions:", formId, selectError.message);
      continue;
    }

    const rows = (expired ?? []) as { id: string; files: string[] | null }[];
    if (rows.length === 0) continue;

    const keys = rows.flatMap((row) => row.files ?? []);
    if (keys.length > 0) {
      await deleteStoredFiles(env.FORM_UPLOADS, keys);
    }

    const ids = rows.map((row) => row.id);
    const { error: deleteError } = await supabase.from("submissions").delete().in("id", ids);
    if (deleteError) {
      console.error("Retention job failed to delete submissions:", formId, deleteError.message);
      continue;
    }

    deleted += ids.length;
    console.log("Retention deleted submissions", { formId, count: ids.length, cutoff });
  }

  return { deleted };
}
