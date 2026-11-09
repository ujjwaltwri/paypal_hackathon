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
  type RowClassParams,
} from "ag-grid-community";
import { VerdictBadge, SourceBadge, WinMeter } from "@/components/Badges";
import { dueLabel, hoursLeft, money, reasonLabel, RESOLUTION_LABEL } from "@/components/format";
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
  headerFontSize: 11,
  headerFontWeight: 600,
  headerTextColor: "#64748b",
  headerBackgroundColor: "#f8fafc",
  borderColor: "#e2e8f0",
  rowHoverColor: "#f1f5ff",
  accentColor: "#1d4ed8",
  wrapperBorderRadius: 12,
  rowHeight: 48,
});

export default function Dashboard() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<{ paypal: any; llm: string | null } | null>(null);
  const [liveError, setLiveError] = useState<string | undefined>();
  const [triageErrors, setTriageErrors] = useState<string[]>([]);
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
        headerName: "Dispute",
        field: "id",
        minWidth: 190,
        cellRenderer: (p: ICellRendererParams<Row>) => (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-700">{p.value}</span>
            <SourceBadge source={p.data!.source} />
          </div>
        ),
      },
      { headerName: "Reason", field: "reason", valueFormatter: (p) => reasonLabel(p.value), minWidth: 180 },
      { headerName: "Buyer", field: "buyerName", minWidth: 140 },
      {
        headerName: "Amount",
        valueGetter: (p) => Number(p.data!.amount.value),
        valueFormatter: (p) => money(p.value, p.data!.amount.currency_code),
        type: "rightAligned",
        minWidth: 115,
      },
      { headerName: "Stage", field: "stage", minWidth: 115, valueFormatter: (p) => (p.value ?? "").toLowerCase() },
      {
        headerName: "Deadline",
        field: "sellerResponseDueDate",
        minWidth: 120,
        sort: "asc",
        comparator: (a, b) => new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime(),
        cellRenderer: (p: ICellRendererParams<Row>) => {
          const h = hoursLeft(p.value);
          const hot = h !== null && h < 96 && !p.data!.resolution;
          return <span className={hot ? "font-semibold text-rose-600" : "text-slate-600"}>{dueLabel(p.value)}</span>;
        },
      },
      {
        headerName: "AI verdict",
        field: "verdict",
        minWidth: 140,
        cellRenderer: (p: ICellRendererParams<Row>) =>
          triage.current === p.data!.id ? (
            <span className="text-xs text-blue-600">Analysing…</span>
          ) : (
            <VerdictBadge verdict={p.value} />
          ),
      },
      { headerName: "Win chance", field: "winProbability", minWidth: 140, cellRenderer: (p: ICellRendererParams<Row>) => <WinMeter p={p.value} /> },
      {
        headerName: "Exp. recovery",
        field: "expectedBest",
        headerTooltip: "Expected money kept if you follow the AI's recommendation",
        minWidth: 135,
        type: "rightAligned",
        valueFormatter: (p) => (p.value === null ? "—" : money(Math.max(0, p.value), p.data!.amount.currency_code)),
      },
      {
        headerName: "Status",
        field: "resolution",
        minWidth: 150,
        cellRenderer: (p: ICellRendererParams<Row>) =>
          p.value ? (
            <span className="text-xs font-medium text-emerald-700">✓ {RESOLUTION_LABEL[p.value]}</span>
          ) : (
            <span className="text-xs text-slate-500">Needs response</span>
          ),
      },
    ],
    [triage.current],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dispute queue</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every open PayPal dispute, investigated by an AI analyst. You approve; it submits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill ok={health?.paypal?.authOk} label={health?.paypal?.configured ? (health.paypal.authOk ? "PayPal sandbox connected" : "PayPal auth failed") : "PayPal: demo data only"} />
          <StatusPill ok={Boolean(health?.llm)} label={health?.llm ?? "No LLM key: rules engine"} />
          <button className="btn-primary" onClick={triageAll} disabled={triage.running || !open.some((r) => !r.verdict)}>
            {triage.running ? `Triaging ${triage.done}/${triage.total}…` : "Triage all with AI"}
          </button>
        </div>
      </div>

      {liveError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Couldn&apos;t load sandbox disputes: {liveError}
        </div>
      )}

      {triageErrors.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          <div className="font-medium">Some analyses hit errors:</div>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {triageErrors.slice(0, 5).map((e, i) => (
              <li key={i} className="break-all">{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Kpi label="Open disputes" value={String(open.length)} />
        <Kpi label="Money at risk" value={money(atRisk)} />
        <Kpi label="Due within 4 days" value={String(urgent)} tone={urgent ? "rose" : undefined} />
        <Kpi label="Analysed" value={`${analysed}/${rows.length}`} />
        <Kpi label="Projected recovery" value={money(projected)} tone="emerald" hint="Expected money kept across open disputes if you follow the AI recommendations" />
      </div>

      <div className="card overflow-hidden" style={{ height: 470 }}>
        <AgGridReact<Row>
          theme={theme}
          rowData={rows}
          columnDefs={cols}
          loading={loading}
          defaultColDef={{ sortable: true, resizable: true, filter: true, flex: 1, cellStyle: { display: "flex", alignItems: "center" } }}
          getRowId={(p) => p.data.id}
          onRowClicked={(e) => router.push(`/disputes/${encodeURIComponent(e.data!.id)}`)}
          rowClass="cursor-pointer"
          getRowStyle={(p: RowClassParams<Row>) => (p.data?.resolution ? { opacity: 0.55 } : undefined)}
        />
      </div>
      <p className="text-xs text-slate-400">
        Click a dispute to see the agent&apos;s investigation and approve a response. Demo disputes are simulated; sandbox
        disputes hit the PayPal Disputes API.{" "}
        <button
          className="underline hover:text-slate-600"
          onClick={async () => {
            await fetch("/api/reset", { method: "POST" });
            load();
          }}
        >
          Reset demo
        </button>
      </p>
    </div>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: string; tone?: "rose" | "emerald"; hint?: string }) {
  const color = tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="card px-4 py-3.5" title={hint}>
      <div className="label">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${color}`}>{value}</div>
    </div>
  );
}

function StatusPill({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 lg:inline-flex">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-300"}`} />
      {label}
    </span>
  );
}
