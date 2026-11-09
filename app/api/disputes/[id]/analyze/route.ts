import { getDisputeById } from "@/lib/disputes";
import { analyzeDispute } from "@/lib/agent/analyze";
import { store } from "@/lib/data/store";
import type { TraceEvent } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Streams the agent's investigation as NDJSON so the UI can show each step live. */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: TraceEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        const d = await getDisputeById(id);
        if (!d) throw new Error("Dispute not found");
        emit({ type: "status", message: `Opened ${d.source === "demo" ? "demo" : "PayPal sandbox"} dispute ${d.id}` });
        const caseFile = await analyzeDispute(d, emit);
        store.putCase(caseFile);
        emit({ type: "case", caseFile });
      } catch (e) {
        emit({ type: "error", message: (e as Error).message });
      }
      emit({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
