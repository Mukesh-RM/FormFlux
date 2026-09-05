import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { Wordmark } from "@/components/wordmark";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Wordmark size="lg" />
          <p className="text-sm leading-relaxed text-muted">
            Sign in with a magic link. No password to forget.
          </p>
        </div>

        <div className="panel animate-fade-in rounded-2xl p-6 shadow-card">
          <Suspense fallback={<div className="h-40" />}>
            <LoginForm />
          </Suspense>
        </div>

        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-[rgb(var(--text))]"
        >
          <ArrowLeft className="size-3.5" />
          Back to home
        </Link>
      </div>
    </main>
  );
}
