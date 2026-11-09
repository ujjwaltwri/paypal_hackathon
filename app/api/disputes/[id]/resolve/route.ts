import { NextResponse } from "next/server";
import { getDisputeById, isDemoDispute } from "@/lib/disputes";
import { store } from "@/lib/data/store";
import * as paypal from "@/lib/paypal/rest";
import type { Resolution } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  action: "FIGHT" | "OFFER_PARTIAL_REFUND" | "ACCEPT";
  note: string;
  offerAmount?: string;
};

/** Human-approved write actions. This is the only place money-affecting calls happen. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Body;
  if (!body.note?.trim()) return NextResponse.json({ error: "A note is required" }, { status: 400 });

  const d = await getDisputeById(id);
  if (!d) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  const c = store.getCase(id);

  const action: Resolution["action"] =
    body.action === "FIGHT" ? "EVIDENCE_SUBMITTED" : body.action === "ACCEPT" ? "CLAIM_ACCEPTED" : "OFFER_MADE";

  let paypalResponse: unknown = { simulated: true };
  const live = !isDemoDispute(id);
  try {
    if (live) {
      if (body.action === "FIGHT") {
        // PayPal only allows certain evidence types per dispute reason/stage.
        // Try the AI's choice first, then the standard fallbacks.
        const preferred = c?.paypalEvidenceType ?? "OTHER";
        const candidates = [
          preferred,
          ...(c?.trackingInfo ? ["PROOF_OF_FULFILLMENT"] : []),
          ...(c?.refundIds?.length ? ["PROOF_OF_REFUND"] : []),
          "OTHER",
        ].filter((t, i, a) => a.indexOf(t) === i);
        let lastErr: unknown;
        for (const evidenceType of candidates) {
          try {
            paypalResponse = await paypal.provideEvidence(id, {
              evidenceType,
              notes: body.note,
              trackingInfo: evidenceType === "PROOF_OF_FULFILLMENT" || evidenceType === preferred ? c?.trackingInfo : undefined,
              refundIds: evidenceType === "PROOF_OF_REFUND" ? c?.refundIds : undefined,
            });
            paypalResponse = { evidenceType, ...(paypalResponse as object) };
            lastErr = undefined;
            break;
          } catch (e) {
            lastErr = e;
            if (!/EVIDENCE_TYPE_IS_NOT_ALLOWED|EVIDENCE_TYPE/i.test((e as Error).message)) throw e;
            console.warn(`[resolve] ${id}: evidence type ${evidenceType} not allowed, trying next`);
          }
        }
        if (lastErr) throw lastErr;
      } else if (body.action === "ACCEPT") {
        paypalResponse = await paypal.acceptClaim(id, body.note);
      } else {
        const value = body.offerAmount ?? c?.suggestedOfferAmount;
        if (!value) return NextResponse.json({ error: "Offer amount required" }, { status: 400 });
        paypalResponse = await paypal.makeOffer(id, body.note, { currency_code: d.amount.currency_code, value });
      }
    }
  } catch (e) {
    console.error(`[resolve] ${id} ${body.action} failed:`, (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const r: Resolution = {
    disputeId: id,
    action,
    at: new Date().toISOString(),
    note: body.note,
    paypalResponse,
    mode: live ? "paypal-sandbox" : "demo",
  };
  store.putResolution(r);
  return NextResponse.json(r);
}
