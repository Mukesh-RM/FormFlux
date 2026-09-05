"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  toastMessage,
  className,
  variant = "secondary",
  size = "sm",
  iconOnly = false,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  toastMessage?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(toastMessage || "Copied to clipboard");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy — your browser blocked clipboard access");
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={iconOnly ? "icon" : size}
      onClick={copy}
      className={cn(className)}
      aria-label={label}
    >
      {copied ? <Check className="text-emerald-600" /> : <Copy />}
      {!iconOnly && <span>{copied ? copiedLabel : label}</span>}
    </Button>
  );
}
