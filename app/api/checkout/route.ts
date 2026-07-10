import { NextResponse } from "next/server";
import { stripe, stripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

// Creates a Stripe Checkout Session for a one-time donation and returns its
// hosted URL. The browser redirects there; Stripe hosts the (accessible)
// payment page and handles cards + Apple Pay + Google Pay + Link.
//
// One-time only for launch (owner decision). Monthly recurring can be added
// later by switching to mode: "subscription" with a recurring Price.

// Guard rails on the amount so a tampered request can't create a $0 or absurd
// session. Amounts arrive in whole dollars from the form.
const MIN_DOLLARS = 1;
const MAX_DOLLARS = 100_000;

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export async function POST(req: Request) {
  if (!stripeConfigured || !stripe) {
    return NextResponse.json(
      { error: "Donations aren't configured yet. Please try again later." },
      { status: 503 }
    );
  }

  let dollars: number;
  let monthly = false;
  try {
    const body = await req.json();
    dollars = Math.round(Number(body?.amount));
    monthly = body?.frequency === "monthly";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!Number.isFinite(dollars) || dollars < MIN_DOLLARS || dollars > MAX_DOLLARS) {
    return NextResponse.json(
      { error: `Please enter an amount between $${MIN_DOLLARS} and $${MAX_DOLLARS.toLocaleString()}.` },
      { status: 400 }
    );
  }

  try {
    // Monthly gifts use subscription mode with an inline recurring price, so no
    // pre-created Products/Prices are needed in the Dashboard. One-time gifts
    // use payment mode. `submit_type` ("donate") is only valid in payment mode.
    const session = await stripe.checkout.sessions.create({
      mode: monthly ? "subscription" : "payment",
      // We deliberately omit `payment_method_types` — Checkout then shows every
      // method enabled in the Stripe Dashboard (cards + Apple Pay + Google Pay +
      // Link) automatically, based on the donor's device/browser.
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: dollars * 100, // Stripe expects the smallest unit (cents)
            ...(monthly ? { recurring: { interval: "month" as const } } : {}),
            product_data: {
              name: monthly
                ? "Monthly donation to RP Hope"
                : "Donation to RP Hope",
              description:
                "Supports research toward treatments for retinitis pigmentosa.",
            },
          },
          quantity: 1,
        },
      ],
      ...(monthly ? {} : { submit_type: "donate" as const }),
      success_url: `${siteUrl()}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/donate/cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "We couldn't start checkout. Please try again." },
      { status: 500 }
    );
  }
}
