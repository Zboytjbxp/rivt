/**
 * Stripe Payment Link integration.
 *
 * Setup:
 *   1. Create a subscription product in your Stripe dashboard ($99/year)
 *   2. Create a Payment Link for it
 *   3. Add to your .env:  VITE_STRIPE_CHECKOUT_URL=https://buy.stripe.com/xxxx
 *   4. In the Stripe Payment Link settings, set the success URL to:
 *      https://rivt.pro/?upgraded=1
 *      (or your local dev URL: http://localhost:8787/?upgraded=1)
 *
 * Gate A rule: billing must fail closed when checkout is not configured.
 * Do not unlock paid features from frontend-only state in production.
 */

const CHECKOUT_URL = import.meta.env.VITE_STRIPE_CHECKOUT_URL as string | undefined;

export function hasStripeConfigured(): boolean {
  return Boolean(CHECKOUT_URL);
}

export function redirectToStripeCheckout(): void {
  if (!CHECKOUT_URL) {
    throw new Error("VITE_STRIPE_CHECKOUT_URL is not configured");
  }
  window.location.href = CHECKOUT_URL;
}
