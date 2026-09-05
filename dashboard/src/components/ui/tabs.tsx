"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex w-full items-center gap-1 overflow-x-auto border-b pb-px",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative whitespace-nowrap px-3.5 py-2.5 text-sm font-medium text-muted transition-colors duration-150",
        "hover:text-[rgb(var(--text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/30",
        "data-[state=active]:text-[rgb(var(--text))]",
        "after:absolute after:inset-x-2 after:-bottom-px after:h-[2px] after:rounded-full after:bg-transparent after:transition-colors",
        "data-[state=active]:after:bg-accent-600 dark:data-[state=active]:after:bg-accent-400",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("mt-6 animate-fade-in focus-visible:outline-none", className)}
      {...props}
    />
  );
}
