/**
 * Referral tracking for the student onboarding flow.
 * Persists seller ref across auth redirects (Stripe, login page, etc.)
 */

const REF_KEY = 'migma_seller_ref';

export function saveSellerRef(ref: string): void {
  if (ref) localStorage.setItem(REF_KEY, ref);
}

export function getSellerRef(): string | null {
  return localStorage.getItem(REF_KEY);
}

export function clearSellerRef(): void {
  localStorage.removeItem(REF_KEY);
}
