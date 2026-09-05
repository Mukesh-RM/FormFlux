"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, Sparkles } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Plan, SubmissionMeta, WebhookLogRow } from "@/lib/types";
import { formatDateShort } from "@/lib/utils";

const DAYS = 30;

type DayPoint = { day: string; label: string; total: number; spam: number };

function emptySeries(): DayPoint[] {
  const points: DayPoint[] = [];
  for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    points.push({ day: key, label: formatDateShort(date), total: 0, spam: 0 });
  }
  return points;
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-[0.72rem] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tightest">{value}</p>
      {hint ? <p className="mt-1 text-[0.78rem] text-muted">{hint}</p> : null}
    </Card>
  );
}

export function AnalyticsTab({ formId, plan }: { formId: string; plan: Plan }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [loading, setLoading] = React.useState(true);
  const [series, setSeries] = React.useState<DayPoint[]>(emptySeries());
  const [stats, setStats] = React.useState({
    total: 0,
    spam: 0,
    captchaPassed: 0,
    captchaAttempted: 0,
    webhookOk: 0,
    webhookTotal: 0,
  });

  React.useEffect(() => {
    if (plan !== "pro") {
      setLoading(false);
      return;
    }

    async function load() {
      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      since.setUTCDate(since.getUTCDate() - (DAYS - 1));

      const [{ data: submissionRows }, { data: logRows }] = await Promise.all([
        supabase
          .from("submissions")
          .select("created_at, is_spam, meta")
          .eq("form_id", formId)
          .gte("created_at", since.toISOString()),
        supabase
          .from("webhook_logs")
          .select("status_code, created_at")
          .eq("form_id", formId)
          .gte("created_at", since.toISOString()),
      ]);

      const points = emptySeries();
      const index = new Map(points.map((point) => [point.day, point]));

      let total = 0;
      let spam = 0;
      let captchaPassed = 0;
      let captchaAttempted = 0;

      for (const row of (submissionRows ?? []) as {
        created_at: string;
        is_spam: boolean;
        meta: SubmissionMeta | null;
      }[]) {
        total += 1;
        if (row.is_spam) spam += 1;

        const captcha = row.meta?.captcha;
        if (captcha === "passed") {
          captchaPassed += 1;
          captchaAttempted += 1;
        } else if (captcha === "skipped_by_field") {
          captchaAttempted += 1;
        }

        const key = row.created_at.slice(0, 10);
        const point = index.get(key);
        if (point) {
          point.total += 1;
          if (row.is_spam) point.spam += 1;
        }
      }

      const logs = (logRows ?? []) as Pick<WebhookLogRow, "status_code">[];
      const webhookOk = logs.filter(
        (log) => (log.status_code ?? 0) >= 200 && (log.status_code ?? 0) < 300,
      ).length;

      setSeries(points);
      setStats({
        total,
        spam,
        captchaPassed,
        captchaAttempted,
        webhookOk,
        webhookTotal: logs.length,
      });
      setLoading(false);
    }

    void load();
  }, [supabase, formId, plan]);

  if (plan !== "pro") {
    return (
      <EmptyState
        icon={<BarChart3 className="size-5" />}
        title="Analytics are a Pro feature"
        description="See submissions per day, how much spam you're blocking, webhook delivery health, and captcha pass rates for the last 30 days."
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

  const webhookRate =
    stats.webhookTotal > 0 ? Math.round((stats.webhookOk / stats.webhookTotal) * 100) : null;
  const captchaRate =
    stats.captchaAttempted > 0
      ? Math.round((stats.captchaPassed / stats.captchaAttempted) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
            </Card>
          ))
        ) : (
          <>
            <Stat label="Submissions" value={String(stats.total)} hint="Last 30 days" />
            <Stat
              label="Spam blocked"
              value={String(stats.spam)}
              hint={stats.total > 0 ? `${Math.round((stats.spam / stats.total) * 100)}% of traffic` : "No traffic yet"}
            />
            <Stat
              label="Webhook success"
              value={webhookRate === null ? "—" : `${webhookRate}%`}
              hint={`${stats.webhookOk}/${stats.webhookTotal} deliveries`}
            />
            <Stat
              label="Captcha pass rate"
              value={captchaRate === null ? "—" : `${captchaRate}%`}
              hint={
                stats.captchaAttempted === 0
                  ? "Captcha not enabled"
                  : `${stats.captchaPassed}/${stats.captchaAttempted} verified`
              }
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submissions per day</CardTitle>
          <CardDescription>Last 30 days, spam shown separately.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64 animate-fade-in">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f95c16" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#f95c16" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" interval={4} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "0.75rem",
                      border: "1px solid rgb(var(--border))",
                      background: "rgb(var(--panel))",
                      fontSize: "0.8rem",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Submissions"
                    stroke="#e2450c"
                    strokeWidth={2}
                    fill="url(#totalFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="spam"
                    name="Spam"
                    stroke="#a8a29e"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    fill="none"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
