export type Money = { currency_code: string; value: string };

export type DisputeReason =
  | "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
  | "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED"
  | "UNAUTHORISED"
  | "CREDIT_NOT_PROCESSED"
  | "DUPLICATE_TRANSACTION"
  | "INCORRECT_AMOUNT"
  | "PAYMENT_BY_OTHER_MEANS"
  | "CANCELED_RECURRING_BILLING"
  | "PROBLEM_WITH_REMITTANCE"
  | "OTHER";

/** Normalised dispute shape used across the app (live PayPal + demo). */
export type Dispute = {
  id: string;
  reason: DisputeReason | string;
  status: string; // e.g. WAITING_FOR_SELLER_RESPONSE, UNDER_REVIEW, RESOLVED
  stage: string; // INQUIRY | CHARGEBACK | PRE_ARBITRATION | ARBITRATION
  amount: Money;
  createdAt: string;
  sellerResponseDueDate?: string;
  transactionId?: string;
  invoiceNumber?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerMessage?: string;
  itemDescription?: string;
  source: "paypal-sandbox" | "demo";
  raw?: unknown;
};

export type Verdict = "FIGHT" | "OFFER_PARTIAL_REFUND" | "ACCEPT";

export type EvidenceItem = {
  label: string;
  detail: string;
  strength: "strong" | "medium" | "weak" | "missing";
};

export type CaseFile = {
  disputeId: string;
  verdict: Verdict;
  winProbability: number; // 0-1
  expectedValue: { fight: number; accept: number; offer?: number; currency: string };
  suggestedOfferAmount?: string;
  summary: string; // 2-3 sentence plain-English explanation for the merchant
  reasoning: string[]; // bullet points
  evidence: EvidenceItem[];
  missingEvidence: string[];
  responseNote: string; // the text that gets sent to PayPal with the evidence
  paypalEvidenceType: string; // PROOF_OF_FULFILLMENT, etc.
  trackingInfo?: { carrier: string; trackingNumber: string };
  refundIds?: string[];
  engine: string; // which model / engine produced it
  createdAt: string;
};

export type TraceEvent =
  | { type: "status"; message: string }
  | { type: "tool"; tool: string; args: unknown; result: unknown }
  | { type: "thought"; text: string }
  | { type: "case"; caseFile: CaseFile }
  | { type: "error"; message: string }
  | { type: "done" };

export type Resolution = {
  disputeId: string;
  action: "EVIDENCE_SUBMITTED" | "CLAIM_ACCEPTED" | "OFFER_MADE" | "RESPONDED_IN_PAYPAL";
  at: string;
  note: string;
  paypalResponse?: unknown;
  mode: "paypal-sandbox" | "demo";
};

