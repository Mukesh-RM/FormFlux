"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 focus-visible:ring-offset-2 ring-offset-panel",
        "data-[state=checked]:bg-accent-600 data-[state=unchecked]:bg-stone-300 dark:data-[state=unchecked]:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

/** Switch with a label and description, used throughout the settings tab. */
export function SwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  badge,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-xl border p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold tracking-tight">{title}</p>
          {badge}
        </div>
        {description ? (
          <p className="text-[0.8rem] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
