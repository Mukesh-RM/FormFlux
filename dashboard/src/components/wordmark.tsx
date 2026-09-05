import Link from "next/link";
import { cn } from "@/lib/utils";

/** FormFlux wordmark: the accent slash is the only accent use in chrome. */
export function Wordmark({
  className,
  href = "/",
  size = "md",
}: {
  className?: string;
  href?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-[0.95rem]",
    md: "text-lg",
    lg: "text-2xl",
  };

  const content = (
    <span
      className={cn(
        "inline-flex items-baseline font-extrabold tracking-tightest",
        sizes[size],
        className,
      )}
    >
      Form
      <span className="text-accent-600 dark:text-accent-400">Flux</span>
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="transition-opacity hover:opacity-80">
      {content}
    </Link>
  );
}
