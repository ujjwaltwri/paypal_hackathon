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
        paypalResponse = await paypal.provideEvidence(id, {
          evidenceType: c?.paypalEvidenceType ?? "OTHER",
          notes: body.note,
          trackingInfo: c?.trackingInfo,
          refundIds: c?.refundIds,
        });
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
