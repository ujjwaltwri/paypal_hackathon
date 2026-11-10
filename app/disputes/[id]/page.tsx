"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CaseFile, Dispute, Resolution, TraceEvent } from "@/lib/types";
import { runAnalysis } from "@/components/run-analysis";
import { Avatar, ReasonIcon, SourceTag, StatusTag, Tag, verdictTone } from "@/components/Badges";
import { dueLabel, money, reasonLabel, RESOLUTION_LABEL, shortDate, stageLabel, VERDICT_LABEL } from "@/components/format";

type Data = { dispute: Dispute; caseFile: CaseFile | null; resolution: Resolution | null; notes: string[] };

const TOOL_LABEL: Record<string, { title: string; source: string }> = {
  get_dispute: { title: "Retrieved the dispute", source: "PayPal Disputes API" },
  get_shipment_tracking: { title: "Checked shipment tracking", source: "PayPal Tracking API" },
  list_buyer_transactions: { title: "Looked for related transactions", source: "PayPal Transactions API" },
  search_merchant_records: { title: "Searched orders and support messages", source: "Store records" },
  get_store_policies: { title: "Read shipping and return policies", source: "Store policies" },
  score_dispute: { title: "Scored the case", source: "Scoring rubric" },
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
      <div className="card p-6 text-[13px]">
        {error}. <Link href="/" className="font-semibold text-brand">Back to disputes</Link>
      </div>
    );
  if (!data) return <div className="text-[13px] text-muted">Loading dispute…</div>;

  const { dispute: d, caseFile: c, resolution } = data;
  const cur = d.amount.currency_code;
  const amount = Number(d.amount.value);
  const offerKeep = Math.max(0, amount - Number(offer || 0));
  const options = [
    { key: "FIGHT" as const, title: "Submit evidence", value: c ? Math.max(0, c.expectedValue.fight) : 0, note: "Send proof to PayPal and keep the payment if you win" },
    { key: "OFFER_PARTIAL_REFUND" as const, title: "Offer partial refund", value: c?.expectedValue.offer !== undefined ? Math.max(0, c.expectedValue.offer) : offerKeep, note: "Buyer keeps the item and gets part of the money back" },
    { key: "ACCEPT" as const, title: "Refund buyer", value: 0, note: "Refund in full and close the case" },
  ];
  const maxValue = Math.max(amount, ...options.map((o) => o.value), 1);
  const tools = trace.filter((e) => e.type === "tool" || e.type === "error");
  const thoughts = trace.filter((e): e is Extract<TraceEvent, { type: "thought" }> => e.type === "thought");
  const steps = [
    { title: "Dispute opened", sub: shortDate(d.createdAt), state: "done" },
    { title: stageLabel(d.stage), sub: d.status === "UNDER_REVIEW" ? "PayPal reviewing" : "With PayPal", state: "done" },
    { title: "Your response", sub: resolution ? RESOLUTION_LABEL[resolution.action] : `Due ${shortDate(d.sellerResponseDueDate)}`, state: resolution ? "done" : "current" },
    { title: "PayPal decision", sub: resolution ? "Waiting" : "After you respond", state: resolution ? "current" : "todo" },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-[13px] text-muted">
        <Link href="/" className="font-medium hover:text-ink">Disputes</Link>
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-subtle" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m8 5 5 5-5 5" /></svg>
        <span className="font-medium text-ink">{d.id}</span>
      </nav>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-6 p-6">
          <div className="flex items-start gap-4">
            <Avatar name={d.buyerName} size={48} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[22px] font-semibold tracking-tight">{d.buyerName ?? "Unknown buyer"}</h1>
                <StatusTag resolution={resolution?.action ?? null} />
                <SourceTag source={d.source} />
              </div>
              <p className="mt-1 text-[14px] text-muted">
                {reasonLabel(d.reason)}
                {d.itemDescription ? ` for ${d.itemDescription}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[13px] text-muted">Disputed amount</div>
            <div className="num text-[28px] font-semibold tracking-tight">{money(d.amount.value, cur)}</div>
          </div>
        </div>
        <ol className="grid grid-cols-2 gap-y-4 border-t border-line px-6 py-4 md:grid-cols-4">
          {steps.map((st, i) => (
            <li key={st.title} className="flex items-start gap-3 pr-4">
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                  st.state === "done" ? "bg-brand text-white" : st.state === "current" ? "bg-brand-soft text-brand ring-2 ring-brand" : "bg-canvas text-subtle ring-1 ring-line"
                }`}
              >
                {st.state === "done" ? (
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10 3 3 7-7" /></svg>
                ) : (
                  i + 1
                )}
              </span>
              <div className="leading-tight">
                <div className={`text-[13px] font-semibold ${st.state === "todo" ? "text-muted" : "text-ink"}`}>{st.title}</div>
                <div className={`mt-0.5 text-[12px] ${st.state === "current" && !resolution ? "font-medium text-warn" : "text-muted"}`}>{st.sub}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {error && <div className="rounded-lg border border-[#fecdca] bg-bad-soft px-4 py-3 text-[13px] text-bad">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="card">
            <CardHeader
              title="Recommendation"
              sub={c && !running ? `Analyzed ${new Date(c.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} with ${c.engine}` : "Based on PayPal data, tracking and your store records"}
              action={
                <button className="btn-secondary" onClick={analyse} disabled={running || Boolean(resolution)}>
                  {running ? "Analyzing…" : c ? "Analyze again" : "Analyze dispute"}
                </button>
              }
            />
            {!c ? (
              <div className="px-6 pb-6 text-[13px] text-muted">
                {running ? "Gathering evidence. Each step appears in the analysis log." : "Run the analysis to get a recommendation and a drafted response."}
              </div>
            ) : (
              <div className="grid gap-6 px-6 pb-6 md:grid-cols-[220px_minmax(0,1fr)]">
                <div>
                  <div className="text-[13px] text-muted">Recommended action</div>
                  <div className="mt-1.5">
                    <Tag tone={verdictTone(c.verdict)} dot>{VERDICT_LABEL[c.verdict]}</Tag>
                  </div>
                  <div className="mt-5 text-[13px] text-muted">Win likelihood</div>
                  <div className="num mt-1 text-[28px] font-semibold tracking-tight">{Math.round(c.winProbability * 100)}%</div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#eaecf0]">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(c.winProbability * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-muted">Expected recovery by option</div>
                  <ul className="mt-2.5 space-y-2.5">
                    {options.map((o) => (
                      <li key={o.key} className="grid grid-cols-[140px_minmax(0,1fr)_80px] items-center gap-3 text-[13px]">
                        <span className={o.key === c.verdict ? "font-semibold text-ink" : "text-body"}>{o.title}</span>
                        <span className="h-2.5 rounded-full bg-canvas">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${(o.value / maxValue) * 100}%`, minWidth: o.value > 0 ? 4 : 0, background: o.key === c.verdict ? "#1d4ed8" : "#d0d5dd" }}
                          />
                        </span>
                        <span className={`num text-right ${o.key === c.verdict ? "font-semibold" : "text-muted"}`}>{money(o.value, cur)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-5 text-[14px] leading-relaxed text-body">{c.summary}</p>
                  {c.reasoning.length > 0 && (
                    <ul className="mt-2 space-y-1 text-[13px] text-muted">
                      {c.reasoning.map((r, i) => (
                        <li key={i} className="flex gap-2">
                          <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-subtle" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 10h6" /></svg>
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>

          {c && (
            <section className="card">
              <CardHeader title="Evidence" sub={`${c.evidence.length} found${c.missingEvidence.length ? `, ${c.missingEvidence.length} missing` : ""}`} />
              <ul className="divide-y divide-line border-t border-line">
                {c.evidence.map((e, i) => (
                  <li key={i} className="flex items-start gap-3 px-6 py-3.5">
                    <EvidenceIcon kind={e.strength} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-ink">{e.label}</div>
                      <div className="mt-0.5 text-[13px] text-muted">{e.detail}</div>
                    </div>
                    <Tag tone={e.strength === "strong" ? "ok" : e.strength === "medium" ? "info" : e.strength === "weak" ? "warn" : "neutral"}>
                      {e.strength.charAt(0).toUpperCase() + e.strength.slice(1)}
                    </Tag>
                  </li>
                ))}
                {c.missingEvidence.map((m, i) => (
                  <li key={`m${i}`} className="flex items-start gap-3 px-6 py-3.5">
                    <EvidenceIcon kind="missing" />
                    <div className="min-w-0 flex-1 text-[13px] text-muted">{m}</div>
                    <Tag tone="neutral">Missing</Tag>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {c && (
            <section className="card">
              <CardHeader title="Your response" sub={resolution ? undefined : "Choose how to respond. Nothing is sent until you confirm."} />
              <div className="px-6 pb-6">
                {resolution ? (
                  <div className="flex items-start gap-3 rounded-lg border border-[#abefc6] bg-ok-soft px-4 py-3 text-[13px] text-ok">
                    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10 3 3 7-7" /></svg>
                    <div>
                      <div className="font-semibold">{RESOLUTION_LABEL[resolution.action]}</div>
                      <div className="mt-0.5">
                        {new Date(resolution.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.{" "}
                        {resolution.action === "RESPONDED_IN_PAYPAL"
                          ? "PayPal shows this dispute waiting on the buyer, so it can't be answered again."
                          : resolution.mode === "demo"
                            ? "Simulated because this is a demo dispute."
                            : "Sent to the PayPal sandbox."}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-3">
                      {options.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setChoice(o.key)}
                          className={`rounded-lg border p-3.5 text-left transition-colors ${choice === o.key ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-line hover:border-[#d0d5dd]"}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13px] font-semibold">{o.title}</span>
                            <span className={`grid h-4 w-4 place-items-center rounded-full border ${choice === o.key ? "border-brand bg-brand" : "border-[#d0d5dd]"}`}>
                              {choice === o.key && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] leading-snug text-muted">{o.note}</p>
                          {c.verdict === o.key && <div className="mt-2 text-[12px] font-semibold text-brand">Recommended</div>}
                        </button>
                      ))}
                    </div>

                    {choice === "OFFER_PARTIAL_REFUND" && (
                      <label className="flex items-center gap-3 text-[13px]">
                        <span className="font-medium">Offer amount</span>
                        <span className="relative">
                          <input value={offer} onChange={(e) => setOffer(e.target.value)} className="field num w-32" inputMode="decimal" />
                        </span>
                        <span className="text-muted">You keep {money(offerKeep, cur)} if the buyer accepts</span>
                      </label>
                    )}

                    <div>
                      <label htmlFor="note" className="text-[13px] font-semibold">Message to PayPal</label>
                      <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={7} className="field mt-1.5 leading-relaxed" />
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
                        <span>Drafted from the evidence above. Edit anything before sending.</span>
                        {c.trackingInfo && choice === "FIGHT" && (
                          <span>
                            Tracking attached: {c.trackingInfo.carrier} {c.trackingInfo.trackingNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-line pt-4">
                      <button className={choice === "ACCEPT" ? "btn-danger" : "btn-primary"} onClick={() => setConfirming(true)} disabled={!note.trim()}>
                        {choice === "FIGHT" ? "Submit evidence" : choice === "ACCEPT" ? "Refund buyer" : "Send offer"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="text-[14px] font-semibold">Buyer&apos;s message</h2>
            <div className="mt-3 flex gap-3">
              <Avatar name={d.buyerName} size={28} />
              <p className="rounded-lg rounded-tl-none bg-canvas px-3 py-2.5 text-[13px] leading-relaxed text-body">
                {d.buyerMessage || "No message from the buyer."}
              </p>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-[14px] font-semibold">Details</h2>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <KV k="Reason" v={<span className="inline-flex items-center gap-2"><ReasonIcon reason={d.reason} />{reasonLabel(d.reason)}</span>} />
              <KV k="Stage" v={stageLabel(d.stage)} />
              <KV k="Respond by" v={`${shortDate(d.sellerResponseDueDate)}, ${dueLabel(d.sellerResponseDueDate).toLowerCase()}`} />
              <KV k="Item" v={d.itemDescription ?? "—"} />
              <KV k="Buyer email" v={d.buyerEmail ?? "—"} />
              <KV k="Transaction" v={d.transactionId ?? "—"} mono />
              <KV k="Dispute ID" v={d.id} mono />
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="text-[14px] font-semibold">Store records</h2>
            <p className="mt-1 text-[12px] text-muted">Add proof the analysis can&apos;t see, like a courier receipt or an email with the buyer. Then analyze again.</p>
            {data.notes.map((n, i) => (
              <p key={i} className="mt-2.5 rounded-lg border border-line bg-canvas px-3 py-2 text-[12px] text-body">{n}</p>
            ))}
            <textarea value={attach} onChange={(e) => setAttach(e.target.value)} rows={3} className="field mt-3" placeholder="Shipped via UPS 1Z… on Nov 3, delivered Nov 6" />
            <button className="btn-secondary mt-2 w-full" onClick={addNote} disabled={!attach.trim()}>
              Add to records
            </button>
          </section>

          {(tools.length > 0 || running) && (
            <section className="card p-5">
              <h2 className="text-[14px] font-semibold">Analysis log</h2>
              <ol className="mt-3 space-y-3">
                {tools.map((e, i) => (
                  <LogItem key={i} e={e} />
                ))}
                {running && (
                  <li className="flex items-center gap-2.5 text-[13px] text-muted">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/25 border-t-brand" /> Working
                  </li>
                )}
              </ol>
              {thoughts.length > 0 && !running && (
                <details className="mt-4 border-t border-line pt-3 text-[13px]">
                  <summary className="cursor-pointer font-medium text-brand">Read the analyst&apos;s notes</summary>
                  <div className="mt-2 max-h-72 space-y-2 overflow-auto text-[12px] leading-relaxed text-muted">
                    {thoughts.map((t, i) => <p key={i} className="whitespace-pre-wrap">{t.text.replace(/\*\*/g, "")}</p>)}
                  </div>
                </details>
              )}
            </section>
          )}
        </aside>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-[#101828]/50 p-4" onClick={() => setConfirming(false)}>
          <div role="dialog" aria-modal className="w-full max-w-[440px] rounded-xl bg-white p-6 shadow-[0_20px_24px_-4px_rgba(16,24,40,0.08),0_8px_8px_-4px_rgba(16,24,40,0.03)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-semibold">
              {choice === "FIGHT" ? "Submit evidence to PayPal?" : choice === "ACCEPT" ? "Refund the buyer?" : "Send a partial refund offer?"}
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              {choice === "FIGHT" && <>Your message{c?.trackingInfo ? " and tracking details" : ""} will be sent to PayPal for dispute {d.id}.</>}
              {choice === "ACCEPT" && <>{money(amount, cur)} will be refunded to {d.buyerName} and the dispute will close.</>}
              {choice === "OFFER_PARTIAL_REFUND" && <>{d.buyerName} will be offered {money(offer || 0, cur)}. They can accept or decline.</>}
              {d.source === "demo" && " This is a demo dispute, so nothing is sent to PayPal."}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="btn-secondary" onClick={() => setConfirming(false)}>Cancel</button>
              <button className={choice === "ACCEPT" ? "btn-danger" : "btn-primary"} onClick={submit} disabled={submitting}>
                {submitting ? "Sending…" : choice === "FIGHT" ? "Submit evidence" : choice === "ACCEPT" ? "Refund buyer" : "Send offer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
      <div>
        <h2 className="text-[16px] font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className={`min-w-0 break-all text-body ${mono ? "text-[12px]" : ""}`}>{v}</dd>
    </div>
  );
}

function EvidenceIcon({ kind }: { kind: string }) {
  const map: Record<string, { bg: string; fg: string; d: string }> = {
    strong: { bg: "#ecfdf3", fg: "#067647", d: "m5 10 3 3 7-7" },
    medium: { bg: "#eef3ff", fg: "#1d4ed8", d: "m5 10 3 3 7-7" },
    weak: { bg: "#fffaeb", fg: "#b54708", d: "M10 6v5m0 3h.01" },
    missing: { bg: "#f2f4f7", fg: "#98a2b3", d: "M6 10h8" },
  };
  const m = map[kind] ?? map.missing;
  return (
    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: m.bg, color: m.fg }}>
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={m.d} /></svg>
    </span>
  );
}

function LogItem({ e }: { e: TraceEvent }) {
  if (e.type === "error")
    return <li className="rounded-md bg-bad-soft px-2.5 py-2 text-[12px] text-bad">{e.message}</li>;
  if (e.type !== "tool") return null;
  const meta = TOOL_LABEL[e.tool] ?? { title: e.tool, source: "" };
  return (
    <li>
      <details className="group text-[13px]">
        <summary className="flex cursor-pointer list-none items-start gap-2.5">
          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ok-soft text-ok">
            <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10 3 3 7-7" /></svg>
          </span>
          <span className="leading-tight">
            <span className="block font-medium text-ink">{meta.title}</span>
            <span className="text-[12px] text-muted">{meta.source}</span>
          </span>
        </summary>
        <pre className="mt-2 max-h-52 overflow-auto rounded-md border border-line bg-canvas p-2.5 text-[11px] leading-snug text-muted">{JSON.stringify(e.result, null, 2)}</pre>
      </details>
    </li>
  );
}
