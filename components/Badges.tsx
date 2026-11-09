import { VERDICT_STYLE } from "./format";

export function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-xs text-slate-400">Not analysed</span>;
  const s = VERDICT_STYLE[verdict];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>
      {s.label}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  return source === "demo" ? (
    <span className="inline-block h-fit self-center rounded bg-slate-100 px-1.5 py-0.5 leading-none text-[10px] font-semibold uppercase tracking-wide text-slate-500">Demo</span>
  ) : (
    <span className="inline-block h-fit self-center rounded bg-blue-50 px-1.5 py-0.5 leading-none text-[10px] font-semibold uppercase tracking-wide text-blue-700">Sandbox</span>
  );
}

export function WinMeter({ p }: { p: number | null }) {
  if (p === null || p === undefined) return <span className="text-xs text-slate-400">—</span>;
  const pct = Math.round(p * 100);
  const color = pct >= 65 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs text-slate-600">{pct}%</span>
    </div>
  );
}
