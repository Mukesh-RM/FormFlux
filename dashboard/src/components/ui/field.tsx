import * as React from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

/** Label + control + inline validation message, used by every settings form. */
export function Field({ label, hint, error, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-[0.8rem] font-semibold tracking-tight text-soft"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="animate-fade-in text-[0.78rem] font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.78rem] leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const baseControl =
  "w-full rounded-lg border bg-transparent px-3 py-2 text-sm transition-colors placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 disabled:opacity-60";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      baseControl,
      "h-10",
      invalid && "border-red-500 focus:border-red-500 focus:ring-red-500/25",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      baseControl,
      "min-h-[7rem] resize-y leading-relaxed",
      invalid && "border-red-500 focus:border-red-500 focus:ring-red-500/25",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(baseControl, "h-10 pr-8", className)} {...props} />
));
Select.displayName = "Select";
