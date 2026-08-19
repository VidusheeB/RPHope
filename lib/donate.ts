// Stripe-hosted donation page. Donors choose their amount (and one-time vs.
// monthly) on Stripe's own page, so there is nothing to configure here — Carin
// can change presets or wording in the Stripe dashboard without a deploy.
//
// This deliberately bypasses the custom Checkout flow in `components/site/
// DonateForm.tsx` + `app/api/checkout/`, which stays in the repo but is dormant:
// it needs a STRIPE_SECRET_KEY we don't have yet. If that key ever arrives and
// an on-site amount picker is wanted, that code is ready to be re-enabled.
export const STRIPE_DONATE_URL = "https://donate.stripe.com/aFacN6ftyg0K77AeGrgQE00";
