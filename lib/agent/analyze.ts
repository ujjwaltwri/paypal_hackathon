import { generateObject, generateText, type CoreMessage } from "ai";
import { z } from "zod";
import type { CaseFile, Dispute, TraceEvent, Verdict } from "../types";
import { buildTools } from "./tools";
import { getModel } from "./model";
import { expectedValues, scoreFacts, type Facts } from "./rubric";

const SYSTEM = `You are Chargeback Copilot, a disputes analyst working for a small online merchant that takes payments through PayPal.
Your job: investigate one PayPal dispute and recommend the option that leaves the merchant best off - FIGHT (submit evidence), OFFER_PARTIAL_REFUND, or ACCEPT (refund the buyer).

How to work:
1. Call get_dispute first.
2. Gather evidence: get_shipment_tracking, search_merchant_records, and get_store_policies. Use list_buyer_transactions for duplicate or unauthorised claims.
3. Call score_dispute exactly once with only facts you verified from tool results. Never invent facts.
4. Then write a short final note on what you found.

Be honest with the merchant. If the evidence is weak or the amount is too small to be worth their time, recommend accepting or a partial refund. Never fabricate tracking numbers, refund IDs or messages.`;

const caseSchema = z.object({
  verdict: z.enum(["FIGHT", "OFFER_PARTIAL_REFUND", "ACCEPT"]),
  summary: z.string().describe("2-3 plain-English sentences for the merchant: what happened and what to do"),
  reasoning: z.array(z.string()).describe("3-6 short bullets explaining the recommendation"),
  evidence: z
    .array(
      z.object({
        label: z.string(),
        detail: z.string(),
        strength: z.enum(["strong", "medium", "weak", "missing"]),
      }),
    )
    .describe("Each piece of evidence found (or missing), with source detail"),
  missingEvidence: z.array(z.string()).describe("Evidence that would strengthen the case but was not found"),
  responseNote: z
    .string()
    .describe(
      "The message to send to PayPal / the buyer. For FIGHT: a factual, professional evidence statement citing tracking numbers, dates, refund IDs and policy text verbatim from tool results. For OFFER: a courteous offer. For ACCEPT: a brief courteous note. Max 1500 characters.",
    ),
  paypalEvidenceType: z
    .enum([
      "PROOF_OF_FULFILLMENT",
      "PROOF_OF_DELIVERY_SIGNATURE",
      "PROOF_OF_REFUND",
      "RETURN_POLICY",
      "ITEM_DESCRIPTION",
      "PROOF_OF_RECEIPT_COPY",
      "OTHER",
    ])
    .describe("Best matching PayPal evidence_type for the submission"),
  trackingInfo: z.object({ carrier: z.string(), trackingNumber: z.string() }).nullable(),
  refundIds: z.array(z.string()).describe("Refund IDs found in merchant records, if any"),
  suggestedOfferAmount: z.string().nullable().describe("For OFFER_PARTIAL_REFUND: amount as decimal string"),
  winProbability: z.number().min(0).max(1).describe("Use the score_dispute result unless you have a strong reason"),
});

export type Emit = (e: TraceEvent) => void;

export async function analyzeDispute(dispute: Dispute, emit: Emit): Promise<CaseFile> {
  const llm = getModel();
  if (!llm) {
    emit({ type: "status", message: "No LLM key configured - running the deterministic rules engine." });
    return rulesEngine(dispute, emit);
  }

  emit({ type: "status", message: `Investigating with ${llm.label}…` });
  const tools = buildTools(dispute);
  let rubric: ReturnType<typeof scoreFacts> | undefined;

  const messages: CoreMessage[] = [
    {
      role: "user",
      content: `Investigate PayPal dispute ${dispute.id} (reason ${dispute.reason}, ${dispute.amount.value} ${dispute.amount.currency_code}, stage ${dispute.stage}, transaction ${dispute.transactionId ?? "unknown"}, buyer ${dispute.buyerEmail ?? "unknown"}).`,
    },
  ];

  const run = await generateText({
    model: llm.model,
    system: SYSTEM,
    messages,
    tools,
    maxSteps: 10,
    temperature: 0.2,
    onStepFinish: (step) => {
      if (step.text?.trim()) emit({ type: "thought", text: step.text.trim() });
      for (const r of step.toolResults ?? []) {
        const tr = r as { toolName: string; args: unknown; result: unknown };
        if (tr.toolName === "score_dispute") rubric = tr.result as typeof rubric;
        emit({ type: "tool", tool: tr.toolName, args: tr.args, result: tr.result });
      }
    },
  });

  emit({ type: "status", message: "Drafting the case file…" });
  // Pass the investigation as a plain-text transcript: some providers reject
  // tool_use blocks in a request that defines no tools.
  const transcript = run.steps
    .flatMap((st) => [
      ...(st.toolResults ?? []).map((r: any) => `TOOL ${r.toolName}(${JSON.stringify(r.args)}) ->\n${JSON.stringify(r.result).slice(0, 4000)}`),
      st.text?.trim() ? `ANALYST NOTE: ${st.text.trim()}` : "",
    ])
    .filter(Boolean)
    .join("\n\n");

  const { object } = await generateObject({
    model: llm.model,
    schema: caseSchema,
    system: SYSTEM,
    prompt:
      `${messages[0].content}\n\nInvestigation transcript:\n${transcript}\n\n` +
      "Now produce the final case file as structured data. Only cite facts that appeared in tool results." +
      (rubric
        ? ` The rubric scored this at ${rubric.probability} win probability; expected money kept: ${JSON.stringify(rubric.expectedValues)}; it suggests ${rubric.suggestedVerdict}${rubric.suggestedOfferAmount ? ` with an offer of ${rubric.suggestedOfferAmount}` : ""}. Follow it unless the evidence clearly says otherwise, and explain why.`
        : ""),
    temperature: 0.2,
  });

  const p = rubric?.probability ?? object.winProbability;
  return finalise(dispute, {
    verdict: object.verdict,
    winProbability: p,
    summary: object.summary,
    reasoning: object.reasoning,
    evidence: object.evidence,
    missingEvidence: object.missingEvidence,
    responseNote: object.responseNote,
    paypalEvidenceType: object.paypalEvidenceType,
    trackingInfo: object.trackingInfo ?? undefined,
    suggestedOfferAmount: object.suggestedOfferAmount ?? rubric?.suggestedOfferAmount,
    refundIds: object.refundIds,
    engine: `${llm.label} + rubric`,
  });
}

function finalise(
  d: Dispute,
  c: Omit<CaseFile, "disputeId" | "expectedValue" | "createdAt"> & { refundIds?: string[] },
): CaseFile & { refundIds?: string[] } {
  const amount = Number(d.amount.value);
  const offer = c.suggestedOfferAmount ? Number(c.suggestedOfferAmount) : undefined;
  return {
    ...c,
    disputeId: d.id,
    expectedValue: { ...expectedValues(amount, c.winProbability, d.stage, offer), currency: d.amount.currency_code },
    createdAt: new Date().toISOString(),
  };
}

/* ---------------------------------------------------------------------------
 * Rules engine fallback: same tools, no LLM. Keeps the app usable for judges
 * who run it without an API key, and doubles as a sanity baseline.
 * ------------------------------------------------------------------------- */

async function rulesEngine(d: Dispute, emit: Emit): Promise<CaseFile> {
  const tools = buildTools(d);
  const call = async <K extends keyof typeof tools>(name: K, args: any) => {
    const t = tools[name] as any;
    const result = await t.execute(args, { toolCallId: String(name), messages: [] });
    emit({ type: "tool", tool: String(name), args, result });
    return result;
  };

  await call("get_dispute", { dispute_id: d.id });
  const tracking: any = d.transactionId ? await call("get_shipment_tracking", { transaction_id: d.transactionId }) : {};
  const records: any = await call("search_merchant_records", { transaction_id: d.transactionId, buyer_email: d.buyerEmail });
  await call("get_store_policies", {});
  const rec = records.record;
  const notes: string[] = rec?.notes ?? [];
  const priorMatch = notes.join(" ").match(/(\d+) prior orders/i);

  const facts: Facts = {
    reason: d.reason,
    has_tracking: Boolean(tracking?.tracking_number),
    delivered: tracking?.status === "DELIVERED",
    signature_on_delivery: Boolean(tracking?.signature_on_delivery),
    address_matches: Boolean(tracking?.shipping_address_matches_paypal),
    refund_already_issued: Boolean(rec?.refunds?.some((r: any) => r.status === "COMPLETED")),
    merchant_offered_resolution: Boolean(
      rec?.supportThread?.some((m: any) => m.from === "merchant" && /refund|return|exchange/i.test(m.text)),
    ),
    listing_discloses_variation: Boolean(rec?.productListing?.disclaimer),
    avs_cvv_match: Boolean(rec?.device?.avsMatch),
    prior_undisputed_orders: priorMatch ? Number(priorMatch[1]) : 0,
    is_separate_transaction: notes.some((n) => /separate orders/i.test(n)),
    amount: Number(d.amount.value),
  };
  const score = await call("score_dispute", facts);
  const verdict: Verdict = score.suggestedVerdict;

  const trackingInfo = facts.has_tracking
    ? { carrier: tracking.carrier, trackingNumber: tracking.tracking_number }
    : undefined;
  const refundIds: string[] = rec?.refunds?.map((r: any) => r.refundId) ?? [];
  const offer: string | undefined = score.suggestedOfferAmount;

  const evidence = score.factors.map((f: any) => ({
    label: f.label,
    detail: f.delta > 0 ? "Supports the merchant" : "Weakens the merchant's case",
    strength: f.delta >= 0.3 ? "strong" : f.delta > 0 ? "medium" : "missing",
  }));

  const responseNote =
    verdict === "FIGHT"
      ? [
          `Order ${rec?.orderId ?? ""} for "${d.itemDescription ?? "the item"}" was fulfilled as described.`,
          trackingInfo ? `Shipped via ${trackingInfo.carrier}, tracking ${trackingInfo.trackingNumber}; carrier status: ${tracking.status}.` : "",
          tracking?.events?.at(-1)?.detail ? `Final carrier scan: ${tracking.events.at(-1).detail}.` : "",
          refundIds.length ? `A full refund was already issued (refund ID ${refundIds.join(", ")}).` : "",
          facts.is_separate_transaction ? `The second charge belongs to a separate order: ${notes.find((n) => /separate/i.test(n))}.` : "",
          facts.prior_undisputed_orders ? `The buyer has ${facts.prior_undisputed_orders} prior undisputed orders to the same address; AVS/CVV matched at checkout.` : "",
          "We respectfully request this dispute be resolved in the seller's favour.",
        ]
          .filter(Boolean)
          .join(" ")
      : verdict === "OFFER_PARTIAL_REFUND"
        ? `We're sorry the item wasn't what you expected. As noted on the listing, each piece is handmade and varies. We'd like to offer a partial refund of ${offer} ${d.amount.currency_code} so you can keep the item.`
        : `We're sorry for the trouble with your order. We've accepted your claim and a full refund is on its way.`;

  return finalise(d, {
    verdict,
    winProbability: score.probability,
    summary:
      verdict === "FIGHT"
        ? `The evidence supports you (${Math.round(score.probability * 100)}% estimated win chance). Submit it before the deadline.`
        : verdict === "OFFER_PARTIAL_REFUND"
          ? "The case is borderline. A partial refund likely costs less than fighting and losing."
          : "Evidence is too thin, or the amount too small, to be worth fighting. Refunding is the cheapest option.",
    reasoning: score.factors.map((f: any) => `${f.delta > 0 ? "+" : ""}${Math.round(f.delta * 100)} pts: ${f.label}`),
    evidence,
    missingEvidence: facts.has_tracking ? [] : ["Carrier tracking number"],
    responseNote,
    paypalEvidenceType: refundIds.length
      ? "PROOF_OF_REFUND"
      : facts.signature_on_delivery
        ? "PROOF_OF_DELIVERY_SIGNATURE"
        : trackingInfo
          ? "PROOF_OF_FULFILLMENT"
          : "OTHER",
    trackingInfo,
    refundIds,
    suggestedOfferAmount: offer,
    engine: "Rules engine (no LLM key)",
  });
}
