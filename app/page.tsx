"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { Avatar, ReasonIcon, SourceTag, StatusTag, VerdictTag, WinBar } from "@/components/Badges";
import Link from "next/link";
import { dueLabel, hoursLeft, money, reasonLabel, shortDate } from "@/components/format";
import { runAnalysis } from "@/components/run-analysis";

ModuleRegistry.registerModules([AllCommunityModule]);

type Row = {
  id: string;
  reason: string;
  status: string;
  stage: string;
  amount: { currency_code: string; value: string };
  sellerResponseDueDate?: string;
  buyerName?: string;
  itemDescription?: string;
  source: string;
  verdict: string | null;
  winProbability: number | null;
  expectedFight: number | null;
  expectedBest: number | null;
  resolution: string | null;
};

const theme = themeQuartz.withParams({
  fontFamily: "Inter, system-ui, sans-serif",
  fontSize: 13,
  headerFontSize: 12,
  headerFontWeight: 500,
  headerTextColor: "#667085",
  headerBackgroundColor: "#f9fafb",
  foregroundColor: "#101828",
  borderColor: "#eaecf0",
  rowBorder: { color: "#eaecf0" },
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  columnBorder: false,
  rowHoverColor: "#f9fafb",
  accentColor: "#1d4ed8",
  rowHeight: 64,
  headerHeight: 40,
  cellHorizontalPadding: 16,
});

export default function Dashboard() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<{ paypal: any; llm: string | null } | null>(null);
  const [liveError, setLiveError] = useState<string | undefined>();
  const [triageErrors, setTriageErrors] = useState<string[]>([]);
  const [tab, setTab] = useState<"open" | "responded" | "all">("open");
  const [query, setQuery] = useState("");
  const [triage, setTriage] = useState<{ running: boolean; current?: string; done: number; total: number }>({
    running: false,
    done: 0,
    total: 0,
  });

  const load = useCallback(async () => {
    const r = await fetch("/api/disputes").then((r) => r.json());
    setRows(r.rows);
    setLiveError(r.liveError);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/health").then((r) => r.json()).then(setHealth);
  }, [load]);

  const open = rows.filter((r) => !r.resolution);
  const atRisk = open.reduce((s, r) => s + Number(r.amount.value), 0);
  const analysed = rows.filter((r) => r.verdict).length;
  const urgent = open.filter((r) => (hoursLeft(r.sellerResponseDueDate) ?? 999) < 96).length;
  const projected = open.reduce((s, r) => s + Math.max(0, r.expectedBest ?? 0), 0);

  async function triageAll() {
    const todo = open.filter((r) => !r.verdict);
    setTriage({ running: true, done: 0, total: todo.length });
    setTriageErrors([]);
    for (const [i, r] of todo.entries()) {
      setTriage((t) => ({ ...t, current: r.id }));
      await runAnalysis(r.id, (e) => {
        if (e.type === "error") setTriageErrors((errs) => [...errs, `${r.id}: ${e.message}`]);
      }).catch((err) => setTriageErrors((errs) => [...errs, `${r.id}: ${err.message}`]));
      setTriage((t) => ({ ...t, done: i + 1 }));
      await load();
    }
    setTriage({ running: false, done: 0, total: 0 });
  }

  const cols = useMemo<ColDef<Row>[]>(
    () => [
      {
        headerName: "Buyer",
        field: "buyerName",
        minWidth: 200,
        getQuickFilterText: (p) => `${p.data?.buyerName ?? ""} ${p.data?.id ?? ""} ${p.data?.itemDescription ?? ""}`,
        cellRenderer: (p: ICellRendererParams<Row>) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={p.value} />
            <div className="min-w-0 leading-tight">
              <div className="truncate font-medium text-ink">{p.value ?? "Unknown buyer"}</div>
              <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-muted">
                {p.data!.id}
                {p.data!.source !== "demo" && <SourceTag source={p.data!.source} />}
              </div>
            </div>
          </div>
        ),
      },
      {
        headerName: "Reason",
        field: "reason",
        minWidth: 200,
        getQuickFilterText: (p) => reasonLabel(p.value),
        cellRenderer: (p: ICellRendererParams<Row>) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <ReasonIcon reason={p.value} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-body">{reasonLabel(p.value)}</div>
              <div className="truncate text-[12px] text-muted">{p.data!.itemDescription ?? ""}</div>
            </div>
          </div>
        ),
      },
      {
        headerName: "Amount",
        valueGetter: (p) => Number(p.data!.amount.value),
        width: 110,
        minWidth: 110,
        flex: 0,
        type: "rightAligned",
        cellRenderer: (p: ICellRendererParams<Row>) => <span className="num font-medium text-ink">{money(p.value, p.data!.amount.currency_code)}</span>,
      },
      {
        headerName: "Respond by",
        field: "sellerResponseDueDate",
        width: 140,
        minWidth: 140,
        flex: 0,
        sort: "asc",
        comparator: (a, b) => new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime(),
        cellRenderer: (p: ICellRendererParams<Row>) => {
          const h = hoursLeft(p.value);
          const urgent = h !== null && h < 96 && !p.data!.resolution;
          return (
            <div className="leading-tight">
              <div className="num text-body">{shortDate(p.value)}</div>
              <div className={`text-[12px] ${urgent ? "font-medium text-bad" : "text-muted"}`}>{p.data!.resolution ? "Responded" : dueLabel(p.value)}</div>
            </div>
          );
        },
      },
      {
        headerName: "Recommendation",
        field: "verdict",
        minWidth: 180,
        cellRenderer: (p: ICellRendererParams<Row>) =>
          triage.current === p.data!.id ? (
            <span className="inline-flex items-center gap-2 text-[13px] text-brand">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand" /> Analyzing
            </span>
          ) : p.data!.resolution ? (
            <StatusTag resolution={p.data!.resolution} />
          ) : (
            <VerdictTag verdict={p.value} />
          ),
      },
      {
        headerName: "Win likelihood",
        field: "winProbability",
        width: 130,
        minWidth: 130,
        flex: 0,
        cellRenderer: (p: ICellRendererParams<Row>) => <WinBar p={p.value} />,
      },
      {
        headerName: "Expected recovery",
        field: "expectedBest",
        width: 145,
        minWidth: 145,
        flex: 0,
        type: "rightAligned",
        cellRenderer: (p: ICellRendererParams<Row>) =>
          p.value === null ? <span className="text-subtle">—</span> : <span className="num text-body">{money(Math.max(0, p.value), p.data!.amount.currency_code)}</span>,
      },
    ],
    [triage.current],
  );

  const responded = rows.length - open.length;
  const shown = rows.filter((r) => (tab === "open" ? !r.resolution : tab === "responded" ? Boolean(r.resolution) : true));
  const upcoming = [...open]
    .filter((r) => r.sellerResponseDueDate)
    .sort((a, b) => new Date(a.sellerResponseDueDate!).getTime() - new Date(b.sellerResponseDueDate!).getTime())
    .slice(0, 3);
  const sumBy = (v: string | null) => open.filter((r) => r.verdict === v).reduce((t, r) => t + Number(r.amount.value), 0);
  const split = [
    { label: "Submit evidence", value: sumBy("FIGHT"), color: "#12b76a" },
    { label: "Partial refund", value: sumBy("OFFER_PARTIAL_REFUND"), color: "#f79009" },
    { label: "Refund", value: sumBy("ACCEPT"), color: "#98a2b3" },
    { label: "Not analyzed", value: sumBy(null), color: "#eaecf0" },
  ].filter((x) => x.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Disputes</h1>
          <p className="mt-1 text-[14px] text-muted">Every open PayPal dispute, investigated and scored so you know which ones are worth fighting.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            onClick={async () => {
              await fetch("/api/reset", { method: "POST" });
              load();
            }}
          >
            Reset demo
          </button>
          <button className="btn-primary" onClick={triageAll} disabled={triage.running || !open.some((r) => !r.verdict)}>
            {triage.running ? `Analyzing ${Math.min(triage.done + 1, triage.total)} of ${triage.total}` : "Analyze open disputes"}
          </button>
        </div>
      </div>

      {(liveError || triageErrors.length > 0) && (
        <div className="space-y-2">
          {liveError && <Alert>Couldn&apos;t load sandbox disputes from PayPal. {liveError}</Alert>}
          {triageErrors.length > 0 && (
            <Alert>
              {triageErrors.length} {triageErrors.length === 1 ? "dispute was" : "disputes were"} scored by the rules engine because the AI model returned an error.
              <span className="mt-1 block text-[12px] opacity-80">{triageErrors[0]}</span>
            </Alert>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="text-[13px] font-medium text-muted">Amount in dispute</div>
          <div className="num mt-2 text-[30px] font-semibold tracking-tight">{money(atRisk)}</div>
          <div className="mt-1 text-[13px] text-muted">
            Across {open.length} open {open.length === 1 ? "dispute" : "disputes"}
          </div>
          {atRisk > 0 && (
            <>
              <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full">
                {split.map((x) => (
                  <div key={x.label} style={{ width: `${(x.value / atRisk) * 100}%`, background: x.color }} title={`${x.label}: ${money(x.value)}`} />
                ))}
              </div>
              <ul className="mt-3 space-y-1 text-[12px] text-body">
                {split.map((x) => (
                  <li key={x.label} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: x.color }} />
                    {x.label}
                    <span className="num ml-auto text-muted">{money(x.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-medium text-muted">Next deadlines</div>
            {urgent > 0 && <span className="text-[12px] font-medium text-bad">{urgent} due within 4 days</span>}
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-6 text-[13px] text-muted">No open disputes. You&apos;re all caught up.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {upcoming.map((r) => {
                const h = hoursLeft(r.sellerResponseDueDate);
                return (
                  <li key={r.id}>
                    <Link href={`/disputes/${encodeURIComponent(r.id)}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                      <Avatar name={r.buyerName} size={28} />
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate text-[13px] font-medium">{r.buyerName}</div>
                        <div className="truncate text-[12px] text-muted">{reasonLabel(r.reason)}</div>
                      </div>
                      <div className="text-right leading-tight">
                        <div className="num text-[13px] font-medium">{money(r.amount.value, r.amount.currency_code)}</div>
                        <div className={`text-[12px] ${h !== null && h < 96 ? "font-medium text-bad" : "text-muted"}`}>{dueLabel(r.sellerResponseDueDate)}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="text-[13px] font-medium text-muted">Expected recovery</div>
          <div className="num mt-2 text-[30px] font-semibold tracking-tight text-ok">{analysed ? money(projected) : "—"}</div>
          <div className="mt-1 text-[13px] text-muted">If you follow each recommendation, compared with refunding everything.</div>
          <div className="mt-4">
            <div className="flex justify-between text-[12px] text-body">
              <span>Analyzed</span>
              <span className="num text-muted">
                {analysed} of {rows.length}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-[#eaecf0]">
              <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${rows.length ? (analysed / rows.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="inline-flex rounded-lg border border-[#d0d5dd] p-0.5 text-[13px] font-semibold">
            {(
              [
                ["open", "Needs response", open.length],
                ["responded", "Responded", responded],
                ["all", "All", rows.length],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-md px-3 py-1.5 ${tab === key ? "bg-canvas text-ink shadow-[0_1px_2px_rgba(16,24,40,0.06)]" : "text-muted hover:text-ink"}`}
              >
                {label}
                <span className="num ml-1.5 text-muted">{count}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="9" cy="9" r="5.5" />
              <path d="m13.5 13.5 3 3" />
            </svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search buyer, item or dispute ID" className="field pl-9" />
          </div>
        </div>
        <AgGridReact<Row>
          theme={theme}
          rowData={shown}
          columnDefs={cols}
          loading={loading}
          quickFilterText={query}
          domLayout="autoHeight"
          defaultColDef={{ sortable: true, resizable: true, filter: false, flex: 1, suppressMovable: true, cellStyle: { display: "flex", alignItems: "center" } }}
          getRowId={(p) => p.data.id}
          onRowClicked={(e) => router.push(`/disputes/${encodeURIComponent(e.data!.id)}`)}
          rowClass="cursor-pointer"
          overlayNoRowsTemplate="<span style='color:#667085;font-size:13px'>No disputes match.</span>"
        />
      </div>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-[#fedf89] bg-warn-soft px-4 py-3 text-[13px] text-warn">{children}</div>;
}
