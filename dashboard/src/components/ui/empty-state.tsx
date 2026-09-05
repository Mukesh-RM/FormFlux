import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared empty state so no screen ever shows a blank table or grid. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "animate-fade-in flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 grid size-12 place-items-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-950/50 dark:text-accent-400">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      {children ? <div className="mt-5 w-full max-w-md text-left">{children}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
