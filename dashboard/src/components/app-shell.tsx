"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Inbox, LayoutGrid, LogOut, Menu, Settings, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/types";

const NAV = [
  { href: "/forms", label: "Forms", icon: LayoutGrid },
  { href: "/archive", label: "Archive", icon: Inbox },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  email,
  plan,
  children,
}: {
  email: string;
  plan: Plan;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Close the mobile drawer whenever the route changes.
  React.useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Mobile top bar */}
      <header className="panel sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X /> : <Menu />}
          </Button>
          <Wordmark size="sm" href="/forms" />
        </div>
        <ThemeToggle />
      </header>

      {open ? (
        <div
          className="fixed inset-0 z-30 bg-stone-950/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "panel z-40 flex flex-col border-r transition-transform duration-200",
          "fixed inset-y-0 left-0 w-64 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="hidden items-center justify-between px-5 py-5 lg:flex">
          <Wordmark href="/forms" />
          <ThemeToggle />
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 lg:py-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300"
                    : "text-muted hover:bg-stone-100 hover:text-[rgb(var(--text))] dark:hover:bg-stone-800/60",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {plan === "free" ? (
          <div className="mx-3 mb-3 rounded-xl border border-accent-200 bg-accent-50/70 p-3.5 dark:border-accent-900 dark:bg-accent-950/30">
            <div className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-accent-800 dark:text-accent-200">
              <Sparkles className="size-3.5" />
              Free plan
            </div>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-accent-800/80 dark:text-accent-200/70">
              1 form, 50 submissions a month. Pro adds uploads, webhooks, and analytics.
            </p>
            <Button asChild variant="primary" size="sm" className="mt-3 w-full">
              <Link href="/pricing">Upgrade</Link>
            </Button>
          </div>
        ) : null}

        <div className="border-t px-4 py-4">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[0.8rem] font-medium text-soft" title={email}>
              {email}
            </p>
            {plan === "pro" ? <Badge tone="accent">Pro</Badge> : null}
          </div>
          <form action="/auth/signout" method="post" className="mt-2">
            <Button type="submit" variant="ghost" size="sm" className="w-full justify-start px-2">
              <LogOut />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
