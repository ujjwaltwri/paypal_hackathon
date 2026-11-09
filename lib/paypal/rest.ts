import type { Dispute } from "../types";

/**
 * Thin REST client for the PayPal Disputes API (sandbox).
 * The Agent Toolkit covers list/get/accept; submitting evidence and making offers
 * are done here directly because they need multipart requests.
 */

const BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

export const hasPayPalCreds = () =>
  Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

let token: { value: string; expires: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const id = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status}): ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return token.value;
}

async function pp<T = any>(pathname: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await getAccessToken()}`);
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string")
    headers.set("Content-Type", "application/json");
  const res = await fetch(`${BASE}${pathname}`, { ...init, headers, cache: "no-store" });
  const text = await res.text();
  const body = text ? safeJson(text) : {};
  if (!res.ok) {
    const msg = (body as any)?.message || (body as any)?.details?.[0]?.description || text;
    throw new Error(`PayPal ${init.method || "GET"} ${pathname} failed (${res.status}): ${msg}`);
  }
  return body as T;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return { raw: t };
  }
}

/* ------------------------------ Disputes ------------------------------ */

export async function listDisputes(): Promise<Dispute[]> {
  const j = await pp<{ items?: any[] }>(`/v1/customer/disputes?page_size=50`);
  const items = j.items ?? [];
  // List endpoint is a summary; fetch details so buyer/transaction info is available.
  const detailed = await Promise.all(
    items.map((it) => getDispute(it.dispute_id).catch(() => normalise(it))),
  );
  return detailed;
}

export async function getDispute(id: string): Promise<Dispute> {
  return normalise(await pp(`/v1/customer/disputes/${encodeURIComponent(id)}`));
}

export async function getDisputeRaw(id: string) {
  return pp(`/v1/customer/disputes/${encodeURIComponent(id)}`);
}

function normalise(d: any): Dispute {
  const tx = d.disputed_transactions?.[0] ?? {};
  const buyerMsg = (d.messages ?? []).filter((m: any) => m.posted_by === "BUYER").map((m: any) => m.content);
  return {
    id: d.dispute_id,
    reason: d.reason ?? "OTHER",
    status: d.status ?? "UNKNOWN",
    stage: d.dispute_life_cycle_stage ?? "INQUIRY",
    amount: d.dispute_amount ?? { currency_code: "USD", value: "0.00" },
    createdAt: d.create_time,
    sellerResponseDueDate: d.seller_response_due_date,
    transactionId: tx.seller_transaction_id,
    invoiceNumber: tx.invoice_number,
    buyerName: tx.buyer?.name,
    buyerEmail: tx.buyer?.email,
    buyerMessage: buyerMsg.join("\n") || d.extensions?.buyer_contacted_channel || undefined,
    itemDescription: tx.items?.map((i: any) => i.item_description || i.item_name).filter(Boolean).join(", "),
    source: "paypal-sandbox",
    raw: d,
  };
}

/** Submit evidence (multipart; the JSON goes in a part named "input"). */
export async function provideEvidence(
  id: string,
  evidence: {
    evidenceType: string;
    notes: string;
    trackingInfo?: { carrier: string; trackingNumber: string };
    refundIds?: string[];
  },
) {
  const evidence_info: Record<string, unknown> = {};
  if (evidence.trackingInfo)
    evidence_info.tracking_info = [
      { carrier_name: evidence.trackingInfo.carrier, tracking_number: evidence.trackingInfo.trackingNumber },
    ];
  if (evidence.refundIds?.length) evidence_info.refund_ids = evidence.refundIds.map((r) => ({ refund_id: r }));

  const input = {
    evidences: [
      {
        evidence_type: evidence.evidenceType,
        ...(Object.keys(evidence_info).length ? { evidence_info } : {}),
        notes: evidence.notes.slice(0, 2000),
      },
    ],
  };
  const form = new FormData();
  form.append("input", new Blob([JSON.stringify(input)], { type: "application/json" }), "input.json");
  return pp(`/v1/customer/disputes/${encodeURIComponent(id)}/provide-evidence`, { method: "POST", body: form });
}

export async function acceptClaim(id: string, note: string) {
  return pp(`/v1/customer/disputes/${encodeURIComponent(id)}/accept-claim`, {
    method: "POST",
    body: JSON.stringify({ note: note.slice(0, 2000) }),
  });
}

export async function makeOffer(id: string, note: string, amount: { currency_code: string; value: string }) {
  return pp(`/v1/customer/disputes/${encodeURIComponent(id)}/make-offer`, {
    method: "POST",
    body: JSON.stringify({ note: note.slice(0, 2000), offer_amount: amount, offer_type: "REFUND" }),
  });
}
