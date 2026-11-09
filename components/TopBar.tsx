"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

type Health = { paypal: { configured: boolean; authOk?: boolean }; llm: string | null };

export function TopBar() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  const paypal = !health
    ? { ok: undefined, label: "Checking PayPal…" }
    : health.paypal.configured
      ? { ok: health.paypal.authOk, label: health.paypal.authOk ? "PayPal sandbox connected" : "PayPal sign-in failed" }
      : { ok: false, label: "PayPal not connected" };
  const ai = !health ? { ok: undefined, label: "Checking AI…" } : { ok: Boolean(health.llm), label: health.llm ?? "No AI model, rules only" };

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-6 px-8">
        <Link href="/" aria-label="Chargeback Copilot home">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-5">
          <div className="hidden items-center gap-4 text-[12px] text-muted md:flex">
            <Status {...paypal} />
            <Status {...ai} />
          </div>
          <span className="hidden h-6 w-px bg-line md:block" />
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#fff1e6] text-[12px] font-semibold text-[#b54708]">KK</span>
            <div className="hidden leading-tight sm:block">
              <div className="text-[13px] font-semibold">Kettle &amp; Kiln</div>
              <div className="text-[12px] text-muted">Merchant</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Status({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-[#12b76a]" : ok === false ? "bg-[#f04438]" : "bg-[#d0d5dd]"}`} />
      {label}
    </span>
  );
}
