"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { TableSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { FormRow, SubmissionRow } from "@/lib/types";
import { formatDate, relativeTime, truncate } from "@/lib/utils";

const PAGE_SIZE = 25;

export function ArchiveSearch({
  forms,
  workerBase,
}: {
  forms: Pick<FormRow, "id" | "name">[];
  workerBase: string;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [formId, setFormId] = React.useState("all");
  const [rows, setRows] = React.useState<SubmissionRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const formNames = React.useMemo(
    () => new Map(forms.map((form) => [form.id, form.name || "Untitled form"])),
    [forms],
  );

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const load = React.useCallback(async () => {
    setLoading(true);

    let request = supabase
      .from("submissions")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (formId !== "all") request = request.eq("form_id", formId);
    if (debounced) request = request.ilike("search_text", `%${debounced}%`);

    const { data, count, error } = await request;
    if (error) {
      toast.error("Search failed", { description: error.message });
      setLoading(false);
      return;
    }

    setRows((data ?? []) as SubmissionRow[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [supabase, page, formId, debounced]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (forms.length === 0) {
    return (
      <EmptyState
        icon={<Archive className="size-5" />}
        title="Nothing archived yet"
        description="Create a form and start collecting submissions — everything you receive stays searchable here until your retention window expires."
        action={
          <Button asChild variant="primary">
            <Link href="/forms">Go to forms</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Search every field of every submission…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            aria-label="Search archive"
          />
        </div>
        <Select
          value={formId}
          onChange={(event) => {
            setFormId(event.target.value);
            setPage(0);
          }}
          aria-label="Filter by form"
          className="sm:w-56"
        >
          <option value="all">All forms</option>
          {forms.map((form) => (
            <option key={form.id} value={form.id}>
              {form.name || "Untitled form"}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="panel rounded-2xl p-4 shadow-card">
          <TableSkeleton rows={8} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="No matches"
          description="Nothing in your history matches that search. Try a shorter term, or switch the form filter back to all forms."
        />
      ) : (
        <div className="panel overflow-hidden rounded-2xl shadow-card">
          <ul className="divide-y">
            {rows.map((row) => {
              const data = row.data ?? {};
              const primary = data.name || data.email || data.subject || "(no name)";
              const preview = data.message || Object.values(data)[0] || "";
              return (
                <li key={row.id} className="animate-fade-in p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/forms/${row.form_id}`}
                      className="text-sm font-semibold tracking-tight hover:text-accent-600 dark:hover:text-accent-400"
                    >
                      {truncate(String(primary), 48)}
                    </Link>
                    <Badge>{formNames.get(row.form_id) ?? "Deleted form"}</Badge>
                    {row.is_spam ? <Badge tone="danger">Spam</Badge> : null}
                    <span
                      className="ml-auto text-[0.75rem] text-muted"
                      title={formatDate(row.created_at)}
                    >
                      {relativeTime(row.created_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">
                    {truncate(String(preview), 160)}
                  </p>
                  {(row.files ?? []).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(row.files ?? []).map((key) => {
                        const filename = key.split("/").pop() || key;
                        return (
                          <a
                            key={key}
                            href={`${workerBase}/files/${row.form_id}/${row.id}/${encodeURIComponent(filename)}`}
                            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[0.75rem] text-muted transition-colors hover:border-accent-400 hover:text-accent-700 dark:hover:text-accent-300"
                          >
                            <Download className="size-3" />
                            {filename}
                          </a>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.8rem] text-muted">
          {total} result{total === 1 ? "" : "s"} · page {page + 1} of {pages}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            disabled={page + 1 >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
