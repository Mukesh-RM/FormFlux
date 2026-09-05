"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Wired to a Stripe Checkout stub — real keys can be added without UI changes. */
export function UpgradeButton({ isSignedIn, isPro }: { isSignedIn: boolean; isPro: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  if (isPro) {
    return (
      <Button variant="secondary" className="w-full" disabled>
        You&apos;re on Pro
      </Button>
    );
  }

  async function upgrade() {
    if (!isSignedIn) {
      router.push("/login?next=/pricing");
      return;
    }

    setPending(true);
    const response = await fetch("/api/checkout", { method: "POST" });
    const result = (await response.json().catch(() => ({}))) as {
      url?: string;
      configured?: boolean;
      error?: string;
    };
    setPending(false);

    if (result.url) {
      window.location.href = result.url;
      return;
    }

    toast.info("Checkout isn't live yet", {
      description:
        result.error ||
        "Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PRICE_ID to enable real payments.",
    });
  }

  return (
    <Button variant="primary" className="w-full" onClick={upgrade} disabled={pending}>
      <Sparkles />
      {pending ? "Opening checkout…" : "Upgrade to Pro"}
    </Button>
  );
}
