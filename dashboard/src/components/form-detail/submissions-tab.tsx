"use client";

import * as React from "react";
import {
  Download,
  FileText,
  Inbox,
  MailCheck,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { TableSkeleton } from "@/components/ui/skeleton";
import { deleteSubmission, setSubmissionSpam } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
import type { SubmissionRow } from "@/lib/types";
import { SPECIAL_FIELD_HELP, cn, formatDate, relativeTime, truncate, workerUrl } from "@/lib/utils";

type Filter = "all" | "spam" | "clean";

const PAGE_SIZE = 20;

/** Fields we show in the summary columns, in order of preference. */
function summaryOf(submission: SubmissionRow): { primary: string; secondary: string } {
  const data = submission.data ?? {};
  const primary = data.name || data.email || data["e-mail"] || data.subject || "(no name)";
  const secondary = data.message || data.email || Object.values(data)[0] || "";
  return { primary: truncate(String(primary), 40), secondary: truncate(String(secondary), 90) };
}

function toCsv(rows: SubmissionRow[]): string {
  const keys = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row.data ?? {})) keys.add(key);
  const headers = ["id", "created_at", "is_spam", "delivered", "ip_address", ...keys, "files"];

  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.created_at,
        row.is_spam,
        row.delivered,
        row.ip_address ?? "",
        ...[...keys].map((key) => row.data?.[key] ?? ""),
        (row.files ?? []).join(" | "),
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function SubmissionsTab({ formId, formName }: { formId: string; formName: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [rows, setRows] = React.useState<SubmissionRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(0);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [active, setActive] = React.useState<SubmissionRow | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const load = React.useCallback(async () => {
    setLoading(true);

    let request = supabase
      .from("submissions")
      .select("*", { count: "exact" })
      .eq("form_id", formId)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filter === "spam") request = request.eq("is_spam", true);
    if (filter === "clean") request = request.eq("is_spam", false);
    // `search_text` is a generated column holding the payload as text, so one
    // ILIKE covers every submitted field regardless of its name.
    if (debouncedQuery) request = request.ilike("search_text", `%${debouncedQuery}%`);

    const { data, count, error } = await request;

    if (error) {
      toast.error("Could not load submissions", { description: error.message });
      setLoading(false);
      return;
    }

    setRows((data ?? []) as SubmissionRow[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [supabase, formId, page, filter, debouncedQuery]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function exportCsv() {
    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("form_id", formId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Export failed", { description: error.message });
      return;
    }

    const csv = toCsv((data ?? []) as SubmissionRow[]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `formflux-${formName.toLowerCase().replace(/\s+/g, "-") || "form"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported", { description: `${data?.length ?? 0} submissions` });
  }

  async function resendEmail(submissionId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      toast.error("Session expired — sign in again");
      return;
    }

    const response = await fetch(workerUrl(`/api/submissions/${submissionId}/resend`), {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
      to?: string;
    };

    if (result.success) {
      toast.success("Notification resent", { description: `Delivered to ${result.to}` });
      void load();
    } else {
      toast.error("Resend failed", { description: result.error || `HTTP ${response.status}` });
    }
  }

  async function toggleSpam(submission: SubmissionRow, isSpam: boolean) {
    const result = await setSubmissionSpam(submission.id, isSpam);
    if (!result.ok) {
      toast.error("Could not update", { description: result.error });
      return;
    }
    toast.success(isSpam ? "Marked as spam" : "Marked as not spam");
    setActive((current) => (current ? { ...current, is_spam: isSpam } : current));
    void load();
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Search submissions…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            aria-label="Search submissions"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            {(
              [
                ["all", "All"],
                ["clean", "Not spam"],
                ["spam", "Spam"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter(value);
                  setPage(0);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[0.78rem] font-medium transition-colors",
                  filter === value
                    ? "bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300"
                    : "text-muted hover:text-[rgb(var(--text))]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button onClick={exportCsv} size="sm">
            <Download />
            CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="panel rounded-2xl p-4 shadow-card">
          <TableSkeleton rows={6} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-5" />}
          title={debouncedQuery || filter !== "all" ? "Nothing matches" : "No submissions yet"}
          description={
            debouncedQuery || filter !== "all"
              ? "Try a different search term or clear the filter."
              : "Once someone submits your form, it shows up here within a second. Send a test submission from the Settings tab snippet to check your wiring."
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="panel hidden overflow-hidden rounded-2xl shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-stone-50/60 text-[0.72rem] uppercase tracking-wider text-muted dark:bg-stone-800/40">
                <tr>
                  <th className="px-4 py-3 font-semibold">From</th>
                  <th className="px-4 py-3 font-semibold">Preview</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Received</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const summary = summaryOf(row);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setActive(row)}
                      className="animate-fade-in cursor-pointer border-b transition-colors last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/40"
                    >
                      <td className="px-4 py-3 font-medium">{summary.primary}</td>
                      <td className="px-4 py-3 text-muted">{summary.secondary}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {row.is_spam ? (
                            <Badge tone="danger">
                              <ShieldAlert className="size-3" />
                              Spam
                            </Badge>
                          ) : row.delivered ? (
                            <Badge tone="success">
                              <MailCheck className="size-3" />
                              Emailed
                            </Badge>
                          ) : (
                            <Badge tone="warning">Not emailed</Badge>
                          )}
                          {(row.files ?? []).length > 0 ? (
                            <Badge>
                              <FileText className="size-3" />
                              {(row.files ?? []).length}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 text-muted"
                        title={formatDate(row.created_at)}
                      >
                        {relativeTime(row.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.map((row) => {
              const summary = summaryOf(row);
              return (
                <button
                  key={row.id}
                  onClick={() => setActive(row)}
                  className="panel animate-fade-in block w-full rounded-xl p-4 text-left shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold tracking-tight">{summary.primary}</p>
                    {row.is_spam ? (
                      <Badge tone="danger">Spam</Badge>
                    ) : row.delivered ? (
                      <Badge tone="success">Emailed</Badge>
                    ) : (
                      <Badge tone="warning">Pending</Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">
                    {summary.secondary}
                  </p>
                  <p className="mt-2 text-[0.75rem] text-ink-faint">
                    {relativeTime(row.created_at)}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.8rem] text-muted">
              {total} submission{total === 1 ? "" : "s"} · page {page + 1} of {pages}
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
        </>
      )}

      <SubmissionDrawer
        submission={active}
        onClose={() => setActive(null)}
        onToggleSpam={toggleSpam}
        onResend={resendEmail}
        onDeleted={() => {
          setActive(null);
          void load();
        }}
        formId={formId}
      />
    </div>
  );
}

function SubmissionDrawer({
  submission,
  onClose,
  onToggleSpam,
  onResend,
  onDeleted,
  formId,
}: {
  submission: SubmissionRow | null;
  onClose: () => void;
  onToggleSpam: (submission: SubmissionRow, isSpam: boolean) => Promise<void>;
  onResend: (id: string) => Promise<void>;
  onDeleted: () => void;
  formId: string;
}) {
  if (!submission) return null;

  const meta = submission.meta ?? {};
  const specials = meta.specialFields ?? [];
  const data = submission.data ?? {};

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent side="right">
        <DialogHeader>
          <DialogTitle>Submission detail</DialogTitle>
          <p className="text-[0.8rem] text-muted">{formatDate(submission.created_at)}</p>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {submission.is_spam ? <Badge tone="danger">Flagged as spam</Badge> : null}
          {submission.delivered ? <Badge tone="success">Owner emailed</Badge> : null}
          <Badge
            tone={
              meta.captcha === "passed"
                ? "success"
                : meta.captcha === "skipped_by_field"
                  ? "warning"
                  : "neutral"
            }
          >
            {meta.captcha === "passed"
              ? "Captcha passed"
              : meta.captcha === "skipped_by_field"
                ? "Captcha skipped by _captcha=false"
                : "Captcha not required"}
          </Badge>
          {submission.ip_address ? <Badge>IP {submission.ip_address}</Badge> : null}
        </div>

        <dl className="mt-5 space-y-3">
          {Object.entries(data).length === 0 ? (
            <p className="text-sm text-muted">This submission had no visible fields.</p>
          ) : null}
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="rounded-lg border p-3">
              <dt className="text-[0.72rem] font-semibold uppercase tracking-wider text-muted">
                {key}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-[0.88rem] leading-relaxed">
                {value || <span className="text-ink-faint">(empty)</span>}
              </dd>
            </div>
          ))}
        </dl>

        {(submission.files ?? []).length > 0 ? (
          <div className="mt-5 space-y-2">
            <h4 className="text-[0.8rem] font-semibold tracking-tight text-soft">Attachments</h4>
            {(submission.files ?? []).map((key) => {
              const filename = key.split("/").pop() || key;
              return (
                <a
                  key={key}
                  href={workerUrl(
                    `/files/${formId}/${submission.id}/${encodeURIComponent(filename)}`,
                  )}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[0.85rem] transition-colors hover:border-accent-400 hover:text-accent-700 dark:hover:text-accent-300"
                >
                  <FileText className="size-4 shrink-0 text-muted" />
                  <span className="truncate">{filename}</span>
                </a>
              );
            })}
          </div>
        ) : null}

        {specials.length > 0 ? (
          <div className="mt-5 space-y-2">
            <h4 className="text-[0.8rem] font-semibold tracking-tight text-soft">
              Special fields used
            </h4>
            <ul className="space-y-1.5">
              {specials.map((field) => (
                <li key={field} className="flex items-start gap-2 text-[0.82rem]">
                  <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.75rem] dark:bg-stone-800">
                    {field}
                  </code>
                  <span className="text-muted">{SPECIAL_FIELD_HELP[field] ?? "Special field"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {(meta.spamReasons ?? []).length > 0 ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-[0.82rem] text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <p className="font-semibold">Why it was flagged</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {(meta.spamReasons ?? []).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 border-t pt-5">
          {submission.is_spam ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onToggleSpam(submission, false)}
            >
              <ShieldCheck />
              Not spam
            </Button>
          ) : (
            <Button size="sm" onClick={() => onToggleSpam(submission, true)}>
              <ShieldAlert />
              Mark as spam
            </Button>
          )}
          <Button size="sm" onClick={() => onResend(submission.id)}>
            <MailCheck />
            Resend email
          </Button>
          <ConfirmDialog
            title="Delete this submission?"
            description="The stored payload and any uploaded files are removed permanently. This cannot be undone."
            confirmLabel="Delete submission"
            onConfirm={async () => {
              const result = await deleteSubmission(submission.id);
              if (result.ok) {
                toast.success("Submission deleted");
                onDeleted();
              } else {
                toast.error("Could not delete", { description: result.error });
              }
            }}
            trigger={
              <Button size="sm" variant="ghost" className="text-muted hover:text-red-600">
                <Trash2 />
                Delete
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
