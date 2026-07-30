import http from "http";
import Stripe from "stripe";

// TEMPORARY diagnostic: log the exact header value when Node rejects it,
// to find the real cause of a recurring "Invalid character in header
// content [Authorization]" error in production.
const _origSetHeader = http.ClientRequest.prototype.setHeader;
(http.ClientRequest.prototype as any).setHeader = function (name: string, value: any) {
  try {
    return _origSetHeader.call(this, name, value);
  } catch (e) {
    const str = String(value);
    console.error(
      "BAD_HEADER_DEBUG",
      JSON.stringify({ name, valueLength: str.length, codes: [...str].map((c) => c.charCodeAt(0)) })
    );
    throw e;
  }
};

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export { DESIGN_TIERS, type DesignTierKey } from "./designTiers";
