"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BarChart3, Inbox, MailWarning, ShieldCheck, SlidersHorizontal, Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsTab } from "@/components/form-detail/analytics-tab";
import { SettingsTab } from "@/components/form-detail/settings-tab";
import { SubmissionsTab } from "@/components/form-detail/submissions-tab";
import { WebhooksTab } from "@/components/form-detail/webhooks-tab";
import { verifyFormFromDashboard } from "@/lib/actions";
import type { FormRow, Plan } from "@/lib/types";

export function FormTabs({
  form,
  plan,
  workerBase,
  canSelfVerify,
}: {
  form: FormRow;
  plan: Plan;
  workerBase: string;
  canSelfVerify: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState("submissions");

  return (
    <div>
      {!form.is_verified ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <MailWarning className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Inbox not confirmed yet
              </p>
              <p className="mt-0.5 text-[0.82rem] leading-relaxed text-amber-800/80 dark:text-amber-200/70">
                Submissions are recorded but not emailed until{" "}
                <span className="font-medium">{form.target_email}</span> is confirmed.
              </p>
            </div>
          </div>
          {canSelfVerify ? (
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                const result = await verifyFormFromDashboard(form.id);
                if (result.ok) {
                  toast.success("Inbox confirmed");
                  router.refresh();
                } else {
                  toast.error("Could not confirm", { description: result.error });
                }
              }}
            >
              <ShieldCheck />
              Confirm this inbox
            </Button>
          ) : (
            <Badge tone="warning">Check that inbox for the link</Badge>
          )}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="submissions">
            <span className="flex items-center gap-2">
              <Inbox className="size-4" />
              Submissions
            </span>
          </TabsTrigger>
          <TabsTrigger value="settings">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4" />
              Settings
            </span>
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <span className="flex items-center gap-2">
              <Webhook className="size-4" />
              Webhooks
            </span>
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <span className="flex items-center gap-2">
              <BarChart3 className="size-4" />
              Analytics
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submissions">
          <SubmissionsTab formId={form.id} formName={form.name || "form"} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab form={form} plan={plan} workerBase={workerBase} />
        </TabsContent>
        <TabsContent value="webhooks">
          <WebhooksTab form={form} plan={plan} />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab formId={form.id} plan={plan} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
