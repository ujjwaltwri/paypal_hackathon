import fs from "node:fs";
import path from "node:path";
import type { CaseFile, Resolution } from "../types";
import { demoMerchantRecords, type MerchantRecord } from "./seed";

/**
 * Tiny JSON-file store. Good enough for a single-merchant prototype and survives
 * dev-server restarts. On ephemeral hosts (Render free tier) it resets on deploy.
 */
type DB = {
  cases: Record<string, CaseFile>;
  resolutions: Record<string, Resolution>;
  attachedNotes: Record<string, string[]>; // disputeId -> merchant-pasted notes
};

const DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "db.json");

let cache: DB | null = null;

function load(): DB {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
  } catch {
    cache = { cases: {}, resolutions: {}, attachedNotes: {} };
  }
  cache.cases ??= {};
  cache.resolutions ??= {};
  cache.attachedNotes ??= {};
  return cache;
}

function save() {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(load(), null, 2));
  } catch (e) {
    console.warn("[store] could not persist", e);
  }
}

export const store = {
  getCase: (id: string) => load().cases[id],
  allCases: () => load().cases,
  putCase(c: CaseFile) {
    load().cases[c.disputeId] = c;
    save();
  },
  getResolution: (id: string) => load().resolutions[id],
  allResolutions: () => load().resolutions,
  putResolution(r: Resolution) {
    load().resolutions[r.disputeId] = r;
    save();
  },
  notes: (id: string) => load().attachedNotes[id] ?? [],
  addNote(id: string, note: string) {
    const db = load();
    db.attachedNotes[id] = [...(db.attachedNotes[id] ?? []), note];
    save();
  },
  reset() {
    cache = { cases: {}, resolutions: {}, attachedNotes: {} };
    save();
  },
};

export function findMerchantRecord(transactionId?: string, email?: string): MerchantRecord | undefined {
  return demoMerchantRecords.find(
    (r) => (transactionId && r.transactionId === transactionId) || (email && r.customerEmail === email),
  );
}

export function customerHistory(email?: string) {
  if (!email) return { orders: 0, disputes: 0 };
  const orders = demoMerchantRecords.filter((r) => r.customerEmail === email);
  const prior = orders.flatMap((o) => o.notes.filter((n) => /prior orders|returning customer/i.test(n)));
  return { ordersOnFile: orders.length, notes: prior };
}
