import { z } from "zod";
import type { Verdict } from "../types";

/**
 * Deterministic, explainable win-likelihood rubric. The LLM gathers the facts,
 * this turns them into a number, so the score is consistent and auditable
 * instead of being a model's gut feeling. Weights are heuristic estimates for
 * a prototype, not PayPal's adjudication rules.
 */

export const factsSchema = z.object({
  reason: z.string().describe("The PayPal dispute reason code"),
  has_tracking: z.boolean().describe("A carrier tracking number exists for the shipment"),
  delivered: z.boolean().describe("Tracking shows DELIVERED"),
  signature_on_delivery: z.boolean().describe("Carrier recorded a signature on delivery"),
  address_matches: z.boolean().describe("Delivered to the address on the PayPal transaction"),
  refund_already_issued: z.boolean().describe("Merchant records show a completed refund for this order"),
  merchant_offered_resolution: z.boolean().describe("Merchant offered a return/refund/exchange in writing before the dispute"),
  listing_discloses_variation: z.boolean().describe("Product listing disclosed the thing the buyer is complaining about"),
  avs_cvv_match: z.boolean().describe("Address/CVV verification matched at checkout"),
  prior_undisputed_orders: z.number().int().min(0).describe("Number of earlier orders by this buyer that were not disputed"),
  is_separate_transaction: z.boolean().describe("For duplicate claims: the 'duplicate' is actually a separate order"),
  amount: z.number().describe("Disputed amount"),
});
export type Facts = z.infer<typeof factsSchema>;

type Factor = { label: string; delta: number };

export function scoreFacts(f: Facts, stage = "INQUIRY") {
  let p = 0.25;
  const factors: Factor[] = [];
  const add = (cond: boolean, label: string, delta: number) => {
    if (cond) {
      p += delta;
      factors.push({ label, delta });
    }
  };
  switch (f.reason) {
    case "MERCHANDISE_OR_SERVICE_NOT_RECEIVED":
      add(!f.has_tracking, "No tracking number", -0.2);
      add(f.has_tracking && !f.delivered, "Tracking not showing delivery", -0.1);
      add(f.delivered, "Carrier confirms delivery", 0.35);
      add(f.delivered && f.address_matches, "Delivered to PayPal address", 0.15);
      add(f.signature_on_delivery, "Signature on delivery", 0.15);
      break;
    case "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED":
      add(f.listing_discloses_variation, "Listing disclosed the variation", 0.15);
      add(f.merchant_offered_resolution, "Merchant offered return/partial refund first", 0.1);
      break;
    case "UNAUTHORISED":
      add(f.avs_cvv_match, "AVS/CVV matched at checkout", 0.15);
      add(f.prior_undisputed_orders > 0, `${f.prior_undisputed_orders} earlier undisputed orders by this buyer`, 0.2);
      add(f.signature_on_delivery, "Signed for by the cardholder's name", 0.15);
      add(f.delivered && f.address_matches, "Delivered to the account holder's address", 0.1);
      break;
    case "CREDIT_NOT_PROCESSED":
      add(f.refund_already_issued, "Refund already completed (has refund ID)", 0.6);
      add(!f.refund_already_issued, "No refund on record", -0.2);
      break;
    case "DUPLICATE_TRANSACTION":
      add(f.is_separate_transaction, "Second charge is a separate, fulfilled order", 0.55);
      add(!f.is_separate_transaction, "No proof the charges are distinct", -0.15);
      break;
    default:
      add(f.delivered, "Item was delivered", 0.1);
  }

  p = Math.round(Math.max(0.03, Math.min(0.95, p)) * 100) / 100;

  // Partial refunds make sense when the buyer received the item but is unhappy with it.
  const offerable = f.reason === "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED";
  const offerAmount = offerable ? Math.round(f.amount * 0.3 * 100) / 100 : undefined;
  const ev = expectedValues(f.amount, p, stage, offerAmount);

  // Pick whichever option leaves the merchant with the most money.
  let suggestedVerdict: Verdict = "ACCEPT";
  let best = ev.accept;
  if (ev.fight > best) {
    suggestedVerdict = "FIGHT";
    best = ev.fight;
  }
  if (ev.offer !== undefined && ev.offer > best) suggestedVerdict = "OFFER_PARTIAL_REFUND";

  return {
    probability: p,
    factors,
    suggestedVerdict,
    expectedValues: ev,
    suggestedOfferAmount: offerAmount?.toFixed(2),
  };
}

/** Estimated cost of a lost chargeback (fee) and of the merchant's time to contest. Configurable. */
export const CHARGEBACK_FEE = Number(process.env.CHARGEBACK_FEE_ESTIMATE || 20);
export const HANDLING_COST = Number(process.env.DISPUTE_HANDLING_COST || 10);
const OFFER_ACCEPT_RATE = 0.75;

/** Expected money the merchant keeps under each option. */
export function expectedValues(amount: number, p: number, stage: string, offer?: number) {
  const fee = stage === "INQUIRY" ? 0 : CHARGEBACK_FEE;
  const round = (n: number) => Math.round(n * 100) / 100;
  const fight = p * amount - (1 - p) * fee - HANDLING_COST;
  return {
    fight: round(fight),
    accept: 0, // refund the buyer: keep nothing, no further cost
    offer:
      offer !== undefined
        ? round(OFFER_ACCEPT_RATE * (amount - offer) + (1 - OFFER_ACCEPT_RATE) * fight)
        : undefined,
  };
}
