import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="max-w-md text-center">
        <Wordmark size="lg" />
        <p className="mt-8 font-mono text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-accent-600 dark:text-accent-400">
          404
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tightest sm:text-3xl">
          This page didn&apos;t submit
        </h1>
        <p className="mt-3 leading-relaxed text-muted">
          The link may be stale, or the form it pointed at was deleted. Your submissions are safe
          either way.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="primary">
            <Link href="/forms">Go to your forms</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/docs">Read the docs</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
