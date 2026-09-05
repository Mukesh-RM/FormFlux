"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, Send, Sparkles, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { FormRow, Plan, WebhookLogRow } from "@/lib/types";
import { formatDate, relativeTime, truncate, workerUrl } from "@/lib/utils";

type Destination = {
  url: string;
  kind: "generic" | "slack" | "discord" | "formsubmit";
  label: string;
  origin: "form" | "submission";
};

function destinationsFor(form: FormRow, historical: string[]): Destination[] {
  const list: Destination[] = [];
  for (const url of form.webhook_urls ?? []) {
    if (url) list.push({ url, kind: "generic", label: "JSON", origin: "form" });
  }
  if (form.slack_webhook_url) {
    list.push({ url: form.slack_webhook_url, kind: "slack", label: "Slack", origin: "form" });
  }
  if (form.discord_webhook_url) {
    list.push({ url: form.discord_webhook_url, kind: "discord", label: "Discord", origin: "form" });
  }
  const configured = new Set(list.map((item) => item.url));
  for (const url of historical) {
    if (url && !configured.has(url)) {
      list.push({ url, kind: "formsubmit", label: "_webhook", origin: "submission" });
    }
  }
  return list;
}

export function WebhooksTab({ form, plan }: { form: FormRow; plan: Plan }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [logs, setLogs] = React.useState<WebhookLogRow[]>([]);
  const [historical, setHistorical] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [testing, setTesting] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);

    const [{ data: logRows }, { data: submissionRows }] = await Promise.all([
      supabase
        .from("webhook_logs")
        .select("*")
        .eq("form_id", form.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("submissions").select("meta").eq("form_id", form.id).limit(500),
    ]);

    setLogs((logRows ?? []) as WebhookLogRow[]);

    const seen = new Set<string>();
    for (const row of (submissionRows ?? []) as { meta: { extraWebhook?: string | null } | null }[]) {
      const url = row.meta?.extraWebhook;
      if (url) seen.add(url);
    }
    setHistorical([...seen]);
    setLoading(false);
  }, [supabase, form.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function sendTest(destination: Destination) {
    setTesting(destination.url);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch(workerUrl(`/api/forms/${form.id}/test-webhook`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ destination: destination.url, type: destination.kind }),
    });

    const result = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      statusCode?: number;
      error?: string;
    };
    setTesting(null);

    if (result.success) {
      toast.success("Test payload delivered", {
        description: `${destination.url} responded ${result.statusCode}`,
      });
    } else {
      toast.error("Test delivery failed", {
        description: result.error || `Destination responded ${result.statusCode ?? response.status}`,
      });
    }
    void load();
  }

  const destinations = destinationsFor(form, historical);

  if (plan !== "pro") {
    return (
      <EmptyState
        icon={<Webhook className="size-5" />}
        title="Webhooks are a Pro feature"
        description="Forward every submission to your own endpoint, Slack, or Discord as JSON, with automatic retries and a full delivery log."
        action={
          <Button asChild variant="primary">
            <Link href="/pricing">
              <Sparkles />
              Upgrade to Pro
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Destinations</CardTitle>
          <CardDescription>
            Configured in Settings. Destinations marked <code>_webhook</code> came from individual
            submissions and are not stored on the form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {destinations.length === 0 ? (
            <p className="text-sm text-muted">
              No destinations yet. Add one in the Settings tab and it will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {destinations.map((destination) => (
                <li
                  key={`${destination.kind}-${destination.url}`}
                  className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
                >
                  <Badge tone={destination.origin === "form" ? "neutral" : "accent"}>
                    {destination.label}
                  </Badge>
                  <code className="min-w-0 flex-1 truncate font-mono text-[0.78rem] text-soft">
                    {destination.url}
                  </code>
                  <Button
                    size="sm"
                    onClick={() => sendTest(destination)}
                    disabled={testing === destination.url}
                  >
                    <Send />
                    {testing === destination.url ? "Sending…" : "Send test"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery log</CardTitle>
          <CardDescription>
            Last 100 attempts, including automatic retries (up to five per destination).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={5} />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<Activity className="size-5" />}
              title="No deliveries yet"
              description="Send a test payload above, or wait for the next submission. Every attempt is recorded here with its status code."
              className="border-0 py-8"
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-[0.72rem] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="py-2.5 pr-4 font-semibold">Status</th>
                      <th className="py-2.5 pr-4 font-semibold">Destination</th>
                      <th className="py-2.5 pr-4 font-semibold">Attempt</th>
                      <th className="py-2.5 pr-4 font-semibold">Response</th>
                      <th className="py-2.5 font-semibold">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const ok = (log.status_code ?? 0) >= 200 && (log.status_code ?? 0) < 300;
                      return (
                        <tr key={log.id} className="animate-fade-in border-b last:border-0">
                          <td className="py-2.5 pr-4">
                            <Badge tone={ok ? "success" : "danger"}>
                              {log.status_code || "failed"}
                            </Badge>
                          </td>
                          <td className="max-w-[16rem] truncate py-2.5 pr-4 font-mono text-[0.76rem] text-muted">
                            {log.destination}
                          </td>
                          <td className="py-2.5 pr-4 text-muted">
                            {log.attempt ?? 1}
                            {log.source === "test" ? " (test)" : ""}
                          </td>
                          <td className="max-w-[18rem] truncate py-2.5 pr-4 text-muted">
                            {log.response_snippet ? truncate(log.response_snippet, 60) : "—"}
                          </td>
                          <td className="py-2.5 text-muted" title={formatDate(log.created_at)}>
                            {relativeTime(log.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 md:hidden">
                {logs.map((log) => {
                  const ok = (log.status_code ?? 0) >= 200 && (log.status_code ?? 0) < 300;
                  return (
                    <li key={log.id} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <Badge tone={ok ? "success" : "danger"}>{log.status_code || "failed"}</Badge>
                        <span className="text-[0.75rem] text-muted">
                          attempt {log.attempt ?? 1} · {relativeTime(log.created_at)}
                        </span>
                      </div>
                      <code className="mt-2 block break-all font-mono text-[0.74rem] text-muted">
                        {log.destination}
                      </code>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
