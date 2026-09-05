import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Stripe Checkout stub. Once STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PRICE_ID are
 * set, create a real Checkout Session here and return its URL — the client already
 * follows `url` when present.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;

  if (!secret || !priceId) {
    return NextResponse.json({
      configured: false,
      error: "Stripe keys are not configured in this environment yet.",
    });
  }

  // Real implementation (kept out until keys exist so the build has no Stripe dep):
  //   const stripe = new Stripe(secret);
  //   const session = await stripe.checkout.sessions.create({
  //     mode: "subscription",
  //     line_items: [{ price: priceId, quantity: 1 }],
  //     customer_email: user.email,
  //     success_url: `${siteUrl()}/forms?upgraded=1`,
  //     cancel_url: `${siteUrl()}/pricing`,
  //     client_reference_id: user.id,
  //   });
  //   return NextResponse.json({ url: session.url });

  return NextResponse.json({
    configured: false,
    error: "Stripe client is not installed in this build. See src/app/api/checkout/route.ts.",
  });
}
