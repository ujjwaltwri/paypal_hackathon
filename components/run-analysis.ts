import type { TraceEvent } from "@/lib/types";

/** Calls the analyze endpoint and yields each NDJSON event as it arrives. */
export async function runAnalysis(id: string, onEvent: (e: TraceEvent) => void) {
  const res = await fetch(`/api/disputes/${encodeURIComponent(id)}/analyze`, { method: "POST" });
  if (!res.body) throw new Error("No response stream");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}
