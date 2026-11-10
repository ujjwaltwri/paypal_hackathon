import { NextResponse } from "next/server";
import { effectiveResolution, listAllDisputes } from "@/lib/disputes";
import { store } from "@/lib/data/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const { disputes, liveError, live } = await listAllDisputes();
  const rows = disputes.map((full) => {
    const { raw, ...d } = full;
    const c = store.getCase(d.id);
    const r = effectiveResolution(full, store.getResolution(d.id));
    return {
      ...d,
      verdict: c?.verdict ?? null,
      winProbability: c?.winProbability ?? null,
      expectedFight: c?.expectedValue.fight ?? null,
      expectedBest: c
        ? c.verdict === "FIGHT"
          ? c.expectedValue.fight
          : c.verdict === "OFFER_PARTIAL_REFUND"
            ? (c.expectedValue.offer ?? 0)
            : c.expectedValue.accept
        : null,
      resolution: r?.action ?? null,
    };
  });
  return NextResponse.json({ rows, live, liveError });
}
