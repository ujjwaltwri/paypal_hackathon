"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CaseFile, Dispute, Resolution, TraceEvent } from "@/lib/types";
import { runAnalysis } from "@/components/run-analysis";
import { SourceBadge, VerdictBadge } from "@/components/Badges";
import { dueLabel, money, reasonLabel, RESOLUTION_LABEL, VERDICT_STYLE } from "@/components/format";

type Data = { dispute: Dispute; caseFile: CaseFile | null; resolution: Resolution | null; notes: string[] };

const TOOL_LABEL: Record<string, string> = {
  get_dispute: "Read dispute from PayPal",
  get_shipment_tracking: "Checked carrier tracking (PayPal Tracking API)",
  list_buyer_transactions: "Searched PayPal transactions",
  search_merchant_records: "Searched store records & support chats",
  get_store_policies: "Read store policies",
  score_dispute: "Scored the case",
};

export default function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const [offer, setOffer] = useState("");
  const [choice, setChoice] = useState<"FIGHT" | "OFFER_PARTIAL_REFUND" | "ACCEPT">("FIGHT");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attach, setAttach] = useState("");
  const dRef = useRef<Dispute | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/disputes/${encodeURIComponent(id)}`);
    const j = await r.json();
    if (!r.ok) return setError(j.error);
    dRef.current = j.dispute;
    setData(j);
    if (j.caseFile) applyCase(j.caseFile);
  }, [id]);

  function applyCase(c: CaseFile) {
    setNote(c.responseNote);
    setChoice(c.verdict);
    setOffer(c.suggestedOfferAmount ?? (Number(dRef.current?.amount.value ?? 0) * 0.3).toFixed(2));
  }

  useEffect(() => {
    load();
  }, [load]);

  async function analyse() {
    setRunning(true);
    setTrace([]);
    await runAnalysis(id, (e) => {
      setTrace((t) => [...t, e]);
      if (e.type === "case") {
        setData((d) => (d ? { ...d, caseFile: e.caseFile } : d));
        applyCase(e.caseFile);
      }
    });
    setRunning(false);
  }

  async function addNote() {
    if (!attach.trim()) return;
    const j = await fetch(`/api/disputes/${encodeURIComponent(id)}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: attach }),
    }).then((r) => r.json());
    setData((d) => (d ? { ...d, notes: j.notes } : d));
    setAttach("");
  }

  async function submit() {
    setSubmitting(true);
    const r = await fetch(`/api/disputes/${encodeURIComponent(id)}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: choice, note, offerAmount: offer || undefined }),
    });
    const j = await r.json();
    setSubmitting(false);
    setConfirming(false);
    if (!r.ok) return setError(j.error);
    setData((d) => (d ? { ...d, resolution: j } : d));
  }

  if (error && !data)
    return (
      <div className="card p-6 text-sm text-rose-700">
        {error} · <Link href="/" className="underline">Back to queue</Link>
      </div>
    );
  if (!data) return <div className="text-sm text-slate-500">Loading…</div>;

  const { dispute: d, caseFile: c, resolution } = data;
  const cur = d.amount.currency_code;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">← Queue</Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{reasonLabel(d.reason)}</h1>
            <SourceBadge source={d.source} />
            {c && <VerdictBadge verdict={c.verdict} />}
          </div>
          <p className="mt-0.5 font-mono text-xs text-slate-500">{d.id}</p>
        </div>
        <div className="flex items-center gap-6 text-right">
          <Stat label="Amount" value={money(d.amount.value, cur)} />
          <Stat label="Stage" value={d.stage.toLowerCase()} />
          <Stat label="Respond by" value={dueLabel(d.sellerResponseDueDate)} />
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Left: the dispute */}
        <div className="space-y-5">
          <section className="card p-4">
            <div className="label">Buyer says</div>
            <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm italic text-slate-700">
              &ldquo;{d.buyerMessage || "No message"}&rdquo;
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <Row k="Buyer" v={d.buyerName ?? "—"} />
              <Row k="Item" v={d.itemDescription ?? "—"} />
              <Row k="Transaction" v={<span className="font-mono text-xs">{d.transactionId ?? "—"}</span>} />
              <Row k="Opened" v={new Date(d.createdAt).toLocaleDateString()} />
            </dl>
          </section>

          <section className="card p-4">
            <div className="label">Attach store records</div>
            <p className="mt-1 text-xs text-slate-500">
              Paste anything the agent can&apos;t see: order notes, an email thread, a courier receipt.
            </p>
            {data.notes.map((n, i) => (
              <p key={i} className="mt-2 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-900">{n}</p>
            ))}
            <textarea
              value={attach}
              onChange={(e) => setAttach(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-blue-400"
              placeholder="e.g. Shipped via DHL 1234567890 on 3 Nov, delivered 6 Nov"
            />
            <button className="btn-ghost mt-2 w-full" onClick={addNote} disabled={!attach.trim()}>
              Attach to case
            </button>
          </section>
        </div>

        {/* Right: investigation + case file */}
        <div className="space-y-5">
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="label">Agent investigation</div>
                {c && !running && (
                  <p className="mt-1 text-xs text-slate-500">
                    Last run {new Date(c.createdAt).toLocaleString()} · {c.engine}
                  </p>
                )}
              </div>
              <button className={c ? "btn-ghost" : "btn-primary"} onClick={analyse} disabled={running || Boolean(resolution)}>
                {running ? "Investigating…" : c ? "Re-run analysis" : "Investigate with AI"}
              </button>
            </div>
            {trace.length > 0 && (
              <ol className="mt-4 space-y-2">
                {trace.map((e, i) => <TraceRow key={i} e={e} />)}
                {running && <li className="pl-6 text-xs text-slate-400">working…</li>}
              </ol>
            )}
            {!trace.length && !c && (
              <p className="mt-3 text-sm text-slate-500">
                The agent will pull the dispute and tracking from PayPal, search your store records and support chats, score
                the case, and draft a response for you to approve.
              </p>
            )}
          </section>

          {c && <CaseView c={c} cur={cur} />}

          {c && (
            <section className="card p-4">
              <div className="label">Your decision</div>
              {resolution ? (
                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  ✓ {RESOLUTION_LABEL[resolution.action]} {resolution.mode === "demo" ? "(simulated, demo dispute)" : "to PayPal sandbox"} on{" "}
                  {new Date(resolution.at).toLocaleString()}.
                </div>
              ) : (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(["FIGHT", "OFFER_PARTIAL_REFUND", "ACCEPT"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setChoice(v)}
                        className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                          choice === v ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="font-medium">
                          {v === "FIGHT" ? "Submit evidence" : v === "ACCEPT" ? "Refund buyer" : "Offer partial refund"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {v === "FIGHT"
                            ? `Expected: ${money(c.expectedValue.fight, cur)}`
                            : v === "ACCEPT"
                              ? `Keep ${money(0, cur)}, no further fees`
                              : `Keep ${money(Number(d.amount.value) - Number(offer || 0), cur)} if accepted`}
                        </div>
                        {c.verdict === v && <div className="mt-1 text-[11px] font-semibold text-blue-700">AI recommendation</div>}
                      </button>
                    ))}
                  </div>
                  {choice === "OFFER_PARTIAL_REFUND" && (
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      Offer amount ({cur})
                      <input
                        value={offer}
                        onChange={(e) => setOffer(e.target.value)}
                        className="w-28 rounded-md border border-slate-200 px-2 py-1 text-sm"
                      />
                    </label>
                  )}
                  <div className="mt-3 label">Message to PayPal / buyer (editable)</div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={6}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 text-sm leading-relaxed outline-none focus:border-blue-400"
                  />
                  {c.trackingInfo && choice === "FIGHT" && (
                    <p className="mt-1 text-xs text-slate-500">
                      Attached: {c.paypalEvidenceType.replaceAll("_", " ").toLowerCase()} · {c.trackingInfo.carrier}{" "}
                      {c.trackingInfo.trackingNumber}
                    </p>
                  )}
                  <div className="mt-3 flex justify-end">
                    <button className={choice === "ACCEPT" ? "btn-danger" : "btn-primary"} onClick={() => setConfirming(true)} disabled={!note.trim()}>
                      Review &amp; send to PayPal
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/40 p-4" onClick={() => setConfirming(false)}>
          <div className="card w-full max-w-md p-5 fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Confirm action</h3>
            <p className="mt-2 text-sm text-slate-600">
              {choice === "FIGHT" && <>Submit evidence for dispute <b>{d.id}</b> to PayPal.</>}
              {choice === "ACCEPT" && <>Accept the claim and refund <b>{money(d.amount.value, cur)}</b> to {d.buyerName}.</>}
              {choice === "OFFER_PARTIAL_REFUND" && <>Offer a partial refund of <b>{money(offer || 0, cur)}</b> to {d.buyerName}.</>}
            </p>
            {d.source === "demo" && <p className="mt-2 text-xs text-slate-500">This is a demo dispute, so the call is simulated.</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
              <button className="btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? "Sending…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CaseView({ c, cur }: { c: CaseFile; cur: string }) {
  const pct = Math.round(c.winProbability * 100);
  const ring = pct >= 65 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#f43f5e";
  return (
    <section className="card p-4 fade-in">
      <div className="label">Case file</div>
      <div className="mt-3 grid gap-5 md:grid-cols-[150px_1fr]">
        <div className="flex flex-col items-center justify-center">
          <div
            className="grid h-28 w-28 place-items-center rounded-full"
            style={{ background: `conic-gradient(${ring} ${pct * 3.6}deg, #eef2f7 0deg)` }}
          >
            <div className="grid h-22 w-22 place-items-center rounded-full bg-white">
              <div className="text-center">
                <div className="text-2xl font-semibold tabular-nums">{pct}%</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500">win chance</div>
              </div>
            </div>
          </div>
          <span className={`mt-3 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${VERDICT_STYLE[c.verdict].cls}`}>
            Recommend: {VERDICT_STYLE[c.verdict].label}
          </span>
        </div>
        <div>
          <p className="text-[15px] leading-relaxed text-slate-800">{c.summary}</p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
            {c.reasoning.map((r, i) => (
              <li key={i} className="flex gap-2"><span className="text-slate-400">•</span>{r}</li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Ev label="If you fight" v={money(c.expectedValue.fight, cur)} />
            <Ev label="Partial refund" v={c.expectedValue.offer !== undefined ? money(c.expectedValue.offer, cur) : "—"} />
            <Ev label="If you refund" v={money(c.expectedValue.accept, cur)} />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">Expected money kept. Includes an estimated chargeback fee when a chargeback is lost.</p>
        </div>
      </div>

      <div className="mt-5 label">Evidence</div>
      <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
        {c.evidence.map((e, i) => (
          <li key={i} className="flex items-start gap-3 px-3 py-2 text-sm">
            <StrengthDot s={e.strength} />
            <div>
              <div className="font-medium text-slate-800">{e.label}</div>
              <div className="text-xs text-slate-500">{e.detail}</div>
            </div>
          </li>
        ))}
        {c.missingEvidence.map((m, i) => (
          <li key={`m${i}`} className="flex items-start gap-3 px-3 py-2 text-sm">
            <StrengthDot s="missing" />
            <div className="text-slate-500">Missing: {m}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TraceRow({ e }: { e: TraceEvent }) {
  if (e.type === "done") return null;
  if (e.type === "status") return <li className="fade-in pl-6 text-xs text-slate-500">{e.message}</li>;
  if (e.type === "error") return <li className="fade-in rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{e.message}</li>;
  if (e.type === "thought") {
    const text = e.text.replace(/\*\*|<br\s*\/?>|\|[-\s|]*\|/g, " ").replace(/\s*\|\s*/g, " · ").replace(/\s+/g, " ").trim();
    if (text.length <= 280) return <li className="fade-in rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{text}</li>;
    return (
      <li className="fade-in">
        <details className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <summary className="cursor-pointer list-none">
            <span className="font-medium text-slate-700">Analyst notes</span> · {text.slice(0, 180)}… <span className="text-blue-600">show more</span>
          </summary>
          <p className="mt-2 leading-relaxed">{text}</p>
        </details>
      </li>
    );
  }
  if (e.type === "case")
    return <li className="fade-in pl-6 text-xs font-medium text-emerald-700">✓ Case file ready</li>;
  return (
    <li className="fade-in">
      <details className="group rounded-md border border-slate-100 px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-blue-100 text-[9px] text-blue-700">✓</span>
          <span className="text-slate-700">{TOOL_LABEL[e.tool] ?? e.tool}</span>
          <span className="ml-auto font-mono text-[10px] text-slate-400">{e.tool}</span>
        </summary>
        <pre className="mt-2 max-h-56 overflow-auto rounded bg-slate-950 p-2 text-[11px] leading-snug text-slate-200">
          {JSON.stringify(e.result, null, 2)}
        </pre>
      </details>
    </li>
  );
}

function StrengthDot({ s }: { s: string }) {
  const c = s === "strong" ? "bg-emerald-500" : s === "medium" ? "bg-amber-400" : s === "weak" ? "bg-orange-400" : "bg-slate-300";
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c}`} />;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-lg font-semibold tabular-nums capitalize">{value}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right text-slate-800">{v}</dd>
    </div>
  );
}
function Ev({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="font-semibold tabular-nums">{v}</div>
    </div>
  );
}
