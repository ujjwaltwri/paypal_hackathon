export const REASONS: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Not as described",
  UNAUTHORISED: "Unauthorized payment",
  CREDIT_NOT_PROCESSED: "Refund not processed",
  DUPLICATE_TRANSACTION: "Duplicate charge",
  INCORRECT_AMOUNT: "Incorrect amount",
  PAYMENT_BY_OTHER_MEANS: "Paid by other means",
  CANCELED_RECURRING_BILLING: "Canceled subscription",
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
  if (h === null) return "No deadline";
  if (h < 0) return "Overdue";
  if (h < 48) return `${h}h left`;
  return `${Math.round(h / 24)} days left`;
}
export const shortDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

export const VERDICT_LABEL: Record<string, string> = {
  FIGHT: "Submit evidence",
  OFFER_PARTIAL_REFUND: "Offer partial refund",
  ACCEPT: "Refund buyer",
};
export const RESOLUTION_LABEL: Record<string, string> = {
  EVIDENCE_SUBMITTED: "Evidence submitted",
  CLAIM_ACCEPTED: "Refunded",
  OFFER_MADE: "Offer sent",
  RESPONDED_IN_PAYPAL: "Responded",
};
export const stageLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replaceAll("_", " ");

export function initials(name?: string) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}
const AVATAR = ["#dbe7ff:#1d4ed8", "#e7f7ee:#067647", "#fff1e6:#b54708", "#f4ebff:#6941c6", "#fde8ef:#c11574", "#e0f2fe:#026aa2"];
export function avatarColors(name?: string) {
  let h = 0;
  for (const ch of name ?? "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = AVATAR[h % AVATAR.length].split(":");
  return { bg, fg };
}
