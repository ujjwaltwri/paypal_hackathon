export const REASONS: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Not as described",
  UNAUTHORISED: "Unauthorised payment",
  CREDIT_NOT_PROCESSED: "Refund not processed",
  DUPLICATE_TRANSACTION: "Duplicate charge",
  INCORRECT_AMOUNT: "Incorrect amount",
  PAYMENT_BY_OTHER_MEANS: "Paid by other means",
  CANCELED_RECURRING_BILLING: "Cancelled subscription",
  PROBLEM_WITH_REMITTANCE: "Remittance problem",
  OTHER: "Other",
};
export const reasonLabel = (r: string) => REASONS[r] ?? r.replaceAll("_", " ").toLowerCase();

export const money = (v: number | string, cur = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(Number(v));

export function hoursLeft(due?: string) {
  if (!due) return null;
  return Math.round((new Date(due).getTime() - Date.now()) / 36e5);
}
export function dueLabel(due?: string) {
  const h = hoursLeft(due);
  if (h === null) return "—";
  if (h < 0) return "Overdue";
  if (h < 48) return `${h}h left`;
  return `${Math.round(h / 24)}d left`;
}

export const VERDICT_STYLE: Record<string, { label: string; cls: string }> = {
  FIGHT: { label: "Fight", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  OFFER_PARTIAL_REFUND: { label: "Offer partial", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  ACCEPT: { label: "Accept", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
};
export const RESOLUTION_LABEL: Record<string, string> = {
  EVIDENCE_SUBMITTED: "Evidence submitted",
  CLAIM_ACCEPTED: "Refunded",
  OFFER_MADE: "Offer sent",
};
