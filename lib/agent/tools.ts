import { tool, type Tool } from "ai";
import { z } from "zod";
import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import type { Dispute } from "../types";
import { demoTracking, storePolicies, demoMerchantRecords } from "../data/seed";
import { findMerchantRecord, customerHistory, store } from "../data/store";
import { factsSchema, scoreFacts, type Facts } from "./rubric";
import { hasPayPalCreds } from "../paypal/rest";

/**
 * The agent's toolbox. PayPal data comes through the official PayPal Agent
 * Toolkit (read-only actions only - the agent can never move money; every
 * write goes through the merchant's explicit approval in the UI).
 * Demo disputes are served from seed data with the same tool names/shapes.
 */

let toolkitTools: Record<string, Tool> | null = null;
function paypalToolkit(): Record<string, Tool> {
  if (toolkitTools) return toolkitTools;
  const tk = new PayPalAgentToolkit({
    clientId: process.env.PAYPAL_CLIENT_ID!,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET!,
    configuration: {
      actions: {
        disputes: { list: true, get: true },
        shipment: { get: true },
        transactions: { list: true },
        orders: { get: true },
      },
      context: { sandbox: process.env.PAYPAL_ENV !== "live" },
    },
  });
  toolkitTools = tk.getTools() as Record<string, Tool>;
  return toolkitTools;
}

async function callToolkit(name: string, args: Record<string, unknown>) {
  const t = paypalToolkit()[name];
  if (!t?.execute) throw new Error(`Toolkit tool ${name} not available`);
  const out = await t.execute(args, { toolCallId: `cc-${name}-${Date.now()}`, messages: [] });
  return typeof out === "string" ? safeParse(out) : out;
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/** Keep tool results small so they fit comfortably in the model context. */
function trim(obj: unknown, max = 1500) {
  const s = JSON.stringify(obj);
  if (!s || s.length <= max) return obj;
  return { truncated: true, preview: s.slice(0, max) };
}

/**
 * Every field optional and nullable, extra keys allowed. Groq validates tool
 * arguments against the schema server-side and rejects e.g. `null` for a
 * boolean, which would abort the whole investigation.
 */
const looseFactsSchema = z
  .object(
    Object.fromEntries(
      Object.entries(factsSchema.shape).map(([k, v]) => [k, (v as z.ZodTypeAny).nullable().optional()]),
    ) as { [K in keyof typeof factsSchema.shape]: z.ZodOptional<z.ZodNullable<(typeof factsSchema.shape)[K]>> },
  )
  .passthrough();

export function buildTools(dispute: Dispute) {
  const live = dispute.source === "paypal-sandbox" && hasPayPalCreds();

  return {
    get_dispute: tool({
      description:
        "Fetch the full PayPal dispute: reason, amount, lifecycle stage, buyer messages, disputed transaction. Always call this first.",
      parameters: z.object({ dispute_id: z.string() }),
      execute: async ({ dispute_id }) => {
        if (live) return compactDispute(await callToolkit("get_dispute", { dispute_id }));
        const { raw, ...d } = dispute;
        return d;
      },
    }),

    get_shipment_tracking: tool({
      description:
        "Get carrier tracking for the disputed transaction from PayPal's shipment tracking API: carrier, tracking number, delivery status, signature.",
      parameters: z.object({ transaction_id: z.string() }),
      execute: async ({ transaction_id }) => {
        if (live) {
          try {
            return trim(await callToolkit("get_shipment_tracking", { transaction_id }));
          } catch (e) {
            return { found: false, error: (e as Error).message };
          }
        }
        return demoTracking[transaction_id] ?? { found: false, note: "No tracking registered for this transaction." };
      },
    }),

    list_buyer_transactions: tool({
      description:
        "List recent PayPal transactions to check for duplicate charges or a buyer's history with this merchant.",
      parameters: z.object({ transaction_id: z.string().optional(), search_months: z.number().int().min(1).max(12).optional() }),
      execute: async ({ transaction_id, search_months }) => {
        if (live) {
          try {
            return trim(await callToolkit("list_transactions", { transaction_id, search_months: search_months ?? 3 }), 1200);
          } catch (e) {
            return { error: (e as Error).message };
          }
        }
        const rec = demoMerchantRecords.find((r) => r.transactionId === transaction_id);
        const sameBuyer = demoMerchantRecords.filter((r) => rec && r.customerEmail === rec.customerEmail);
        return {
          transactions: sameBuyer.map((r) => ({ transaction_id: r.transactionId, order: r.orderId, items: r.items })),
          note: rec?.notes.find((n) => /separate orders|TWO/i.test(n)),
        };
      },
    }),

    search_merchant_records: tool({
      description:
        "Search the merchant's own store records for this order: order notes, shipping address, support chat history, refunds issued, checkout device/AVS data, the product listing text, and notes the merchant attached to this dispute.",
      parameters: z.object({ transaction_id: z.string().optional(), buyer_email: z.string().optional() }),
      execute: async ({ transaction_id, buyer_email }) => {
        const rec = findMerchantRecord(transaction_id ?? dispute.transactionId, buyer_email ?? dispute.buyerEmail);
        const attached = store.notes(dispute.id);
        if (!rec && !attached.length)
          return { found: false, note: "No internal records found for this order. Ask the merchant to attach order details." };
        return {
          found: true,
          // Notes the merchant pasted for this dispute are their own order records and count as evidence.
          merchantAttachedRecords: attached,
          orderRecord: rec ?? null,
          customerHistory: rec ? customerHistory(rec.customerEmail) : undefined,
        };
      },
    }),

    get_store_policies: tool({
      description: "The merchant's published shipping, returns and product-variation policies.",
      parameters: z.object({}),
      execute: async () => storePolicies,
    }),

    score_dispute: tool({
      description:
        "Score the merchant's chance of winning with a deterministic rubric and compute the expected money kept for each option (fight / partial refund / accept). Call this once after gathering evidence, passing only facts you verified from the other tools.",
      // Deliberately permissive: some open models mangle long described schemas
      // (e.g. using the field descriptions as keys). We accept loose input and
      // normalise it ourselves rather than failing the whole investigation.
      parameters: looseFactsSchema,
      execute: async (raw) => scoreFacts(normaliseFacts(raw as Record<string, unknown>, dispute), dispute.stage),
    }),
  };
}

/** Map whatever the model sent onto the rubric's fields, tolerating mangled keys. */
export function normaliseFacts(raw: Record<string, unknown>, dispute: Dispute): Facts {
  const shape = factsSchema.shape as Record<string, { description?: string }>;
  const fields = Object.keys(shape);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const k = key.trim();
    const field =
      fields.find((f) => f === k) ??
      fields.find((f) => k.endsWith(` ${f}`) || k.startsWith(`${f} `)) ??
      fields.find((f) => shape[f].description && k.toLowerCase().startsWith(shape[f].description!.toLowerCase()));
    if (field && out[field] === undefined) out[field] = value;
  }
  const bool = (v: unknown) => v === true || v === "true" || v === 1 || v === "yes";
  const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);
  return {
    reason: typeof out.reason === "string" && out.reason ? out.reason : dispute.reason,
    has_tracking: bool(out.has_tracking),
    delivered: bool(out.delivered),
    signature_on_delivery: bool(out.signature_on_delivery),
    address_matches: bool(out.address_matches),
    refund_already_issued: bool(out.refund_already_issued),
    merchant_offered_resolution: bool(out.merchant_offered_resolution),
    listing_discloses_variation: bool(out.listing_discloses_variation),
    avs_cvv_match: bool(out.avs_cvv_match),
    prior_undisputed_orders: Math.max(0, Math.round(num(out.prior_undisputed_orders, 0))),
    is_separate_transaction: bool(out.is_separate_transaction),
    amount: num(out.amount, Number(dispute.amount.value)),
  };
}

/**
 * The raw dispute JSON is large (links, extensions, nested objects) and eats
 * the token budget on free-tier models. Keep only what matters for the case.
 */
function compactDispute(raw: any) {
  if (!raw || typeof raw !== "object") return trim(raw);
  const tx = raw.disputed_transactions?.[0] ?? {};
  return {
    dispute_id: raw.dispute_id,
    reason: raw.reason,
    status: raw.status,
    stage: raw.dispute_life_cycle_stage,
    amount: raw.dispute_amount,
    created: raw.create_time,
    seller_response_due: raw.seller_response_due_date,
    seller_transaction_id: tx.seller_transaction_id,
    buyer: tx.buyer?.name,
    items: (tx.items ?? []).map((i: any) => i.item_description || i.item_name).filter(Boolean),
    seller_protection_eligible: tx.seller_protection_eligible,
    buyer_messages: (raw.messages ?? []).filter((m: any) => m.posted_by === "BUYER").map((m: any) => String(m.content ?? "").slice(0, 400)),
    buyer_requested_amount: raw.offer?.buyer_requested_amount,
  };
}
