import type { Dispute } from "./types";
import { demoDisputes } from "./data/seed";
import * as paypal from "./paypal/rest";

export const isLive = () => paypal.hasPayPalCreds() && process.env.DEMO_ONLY !== "true";
export const includeDemo = () => !isLive() || process.env.INCLUDE_DEMO_DISPUTES !== "false";

export type QueueResult = { disputes: Dispute[]; liveError?: string; live: boolean };

export async function listAllDisputes(): Promise<QueueResult> {
  const out: Dispute[] = [];
  let liveError: string | undefined;
  if (isLive()) {
    try {
      out.push(...(await paypal.listDisputes()));
    } catch (e) {
      liveError = (e as Error).message;
    }
  }
  if (includeDemo()) out.push(...demoDisputes());
  return { disputes: out, liveError, live: isLive() };
}

export async function getDisputeById(id: string): Promise<Dispute | undefined> {
  const demo = demoDisputes().find((d) => d.id === id);
  if (demo) return demo;
  if (isLive()) return paypal.getDispute(id);
  return undefined;
}

export const isDemoDispute = (id: string) => id.startsWith("PP-D-DEMO-");
