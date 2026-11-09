import { avatarColors, initials, RESOLUTION_LABEL, VERDICT_LABEL } from "./format";

const TONE = {
  ok: "bg-ok-soft text-ok ring-[#abefc6]",
  warn: "bg-warn-soft text-warn ring-[#fedf89]",
  bad: "bg-bad-soft text-bad ring-[#fecdca]",
  neutral: "bg-canvas text-body ring-line",
  info: "bg-brand-soft text-brand ring-[#c7d7fe]",
};

export function Tag({ tone, children, dot }: { tone: keyof typeof TONE; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 self-center whitespace-nowrap rounded-md px-2 text-[12px] font-medium leading-none ring-1 ring-inset ${TONE[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const verdictTone = (v: string) => (v === "FIGHT" ? "ok" : v === "OFFER_PARTIAL_REFUND" ? "warn" : "neutral") as keyof typeof TONE;

export function VerdictTag({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-[13px] text-subtle">Not analyzed</span>;
  return <Tag tone={verdictTone(verdict)} dot>{VERDICT_LABEL[verdict]}</Tag>;
}

export function StatusTag({ resolution }: { resolution: string | null }) {
  return resolution ? <Tag tone="info">{RESOLUTION_LABEL[resolution]}</Tag> : <Tag tone="warn">Needs response</Tag>;
}

export function SourceTag({ source }: { source: string }) {
  return source === "demo" ? <Tag tone="neutral">Demo</Tag> : <Tag tone="info">Sandbox</Tag>;
}

export function Avatar({ name, size = 32 }: { name?: string; size?: number }) {
  const { bg, fg } = avatarColors(name);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold leading-none"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function WinBar({ p }: { p: number | null }) {
  if (p === null || p === undefined) return <span className="text-subtle">—</span>;
  const pct = Math.round(p * 100);
  const c = pct >= 65 ? "#12b76a" : pct >= 40 ? "#f79009" : "#f04438";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-[#eaecf0]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
      </div>
      <span className="num w-8 text-[13px] text-body">{pct}%</span>
    </div>
  );
}

const REASON_ICON: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "M3 7l7-4 7 4v6l-7 4-7-4V7zm7-4v14M3 7l7 4 7-4",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "M4 4h12v12H4zM7 8h6M7 11h4",
  UNAUTHORISED: "M6 9V7a4 4 0 118 0v2M5 9h10v8H5z",
  CREDIT_NOT_PROCESSED: "M4 10a6 6 0 1010-4.5M14 2v4h-4",
  DUPLICATE_TRANSACTION: "M7 7h9v9H7zM4 4h9v3M4 4v9h3",
};
export function ReasonIcon({ reason }: { reason: string }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted">
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <path d={REASON_ICON[reason] ?? "M10 4v7m0 4h.01"} />
      </svg>
    </span>
  );
}
