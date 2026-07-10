import Stripe from "stripe";

// Server-only Stripe client. Reads STRIPE_SECRET_KEY from the environment
// (`.env.local` locally, Vercel env vars in prod). Never import this into a
// Client Component — the secret key must stay on the server.
//
// Like `supabaseConfigured`, we guard on the key being present so the app still
// builds/runs without Stripe configured (the donate button just returns an
// error instead of crashing the page).
const key = process.env.STRIPE_SECRET_KEY;

export const stripeConfigured = Boolean(key);

export const stripe = key ? new Stripe(key) : null;
