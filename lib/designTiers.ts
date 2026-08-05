// Split out from lib/stripe.ts so client components can import tier info
// without accidentally bundling the server-only Stripe SDK.
//
// conceptsPerPhoto applies PER uploaded reference photo, not as a flat
// total — e.g. Standard with 3 photos uploaded produces 30 concept images
// (10 per photo), not 10 total. Video count/length is still a flat total
// per order regardless of photo count (kept that way deliberately — video
// is the expensive part, and letting it also multiply by photo count would
// make cost unpredictable).
export const DESIGN_TIERS = {
  standard: {
    label: "Standard",
    price: 40,
    conceptsPerPhoto: 10,
    videoCount: 1,
    videoDurationSeconds: 8,
    note: "10 designs per photo + 1 short video",
  },
  better: {
    label: "Better",
    price: 70,
    conceptsPerPhoto: 15,
    videoCount: 2,
    videoDurationSeconds: 8,
    note: "15 designs per photo + 2 short videos",
  },
  highest: {
    label: "Highest",
    price: 100,
    conceptsPerPhoto: 20,
    videoCount: 3,
    videoDurationSeconds: 8,
    note: "20 designs per photo + 3 short videos",
  },
  premium: {
    label: "Premium",
    price: 150,
    conceptsPerPhoto: 20,
    videoCount: 1,
    videoDurationSeconds: 40,
    note: "20 designs per photo + 1 extended 40-second video",
  },
} as const;

export type DesignTierKey = keyof typeof DESIGN_TIERS;

// Only photos can seed image generation, not videos someone attached for
// context — used both to filter which uploaded files count toward the
// per-photo concept multiplier and to pick real reference images at
// generation time.
export function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(url);
}

// Total concepts for an order = tier's per-photo count × however many real
// reference photos were uploaded (minimum 1, so a tier still works even if
// url filtering somehow finds zero — matches the fallback already used at
// generation time).
export function computeConceptCount(tier: DesignTierKey, photoUrls: string[]): number {
  const photoCount = Math.max(1, photoUrls.filter(isImageUrl).length || photoUrls.length);
  return DESIGN_TIERS[tier].conceptsPerPhoto * photoCount;
}
