import Link from "next/link";
import { Github } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
];

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-[rgb(var(--bg))]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-[rgb(var(--text))]"
            >
              {link.label}
            </Link>
          ))}
          <ThemeToggle />
          <Button asChild variant="primary" size="sm" className="ml-1">
            <Link href="/login">Get started</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1">
          <Wordmark size="sm" />
          <p className="text-[0.8rem] text-muted">
            Form backends without the backend. Runs on free tiers.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.85rem] text-muted">
          <Link href="/docs" className="transition-colors hover:text-[rgb(var(--text))]">
            Docs
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-[rgb(var(--text))]">
            Pricing
          </Link>
          <Link href="/login" className="transition-colors hover:text-[rgb(var(--text))]">
            Sign in
          </Link>
          <a
            href="https://github.com"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-[rgb(var(--text))]"
          >
            <Github className="size-3.5" />
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
