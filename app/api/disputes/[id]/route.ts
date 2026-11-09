import { NextResponse } from "next/server";
import { getDisputeById } from "@/lib/disputes";
import { store } from "@/lib/data/store";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const d = await getDisputeById(id);
    if (!d) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    const { raw, ...dispute } = d;
    return NextResponse.json({
      dispute,
      caseFile: store.getCase(id) ?? null,
      resolution: store.getResolution(id) ?? null,
      notes: store.notes(id),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
