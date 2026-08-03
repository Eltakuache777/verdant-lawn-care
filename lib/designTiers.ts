// Split out from lib/stripe.ts so client components can import tier info
// without accidentally bundling the server-only Stripe SDK.
export const DESIGN_TIERS = {
  standard: { label: "Standard", price: 40, concepts: 5, note: "5 designs" },
  better: { label: "Better", price: 70, concepts: 15, note: "15 designs, better quality" },
  highest: { label: "Highest", price: 100, concepts: 50, note: "50+ designs, fastest & highest quality" },
} as const;

export type DesignTierKey = keyof typeof DESIGN_TIERS;
