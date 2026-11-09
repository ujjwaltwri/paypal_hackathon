import type { Dispute } from "../types";

/**
 * Demo data for "Kettle & Kiln", a fictional small online shop selling
 * handmade ceramics and coffee gear. Dates are relative to "now" so the
 * queue always looks live.
 */

const day = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

export function demoDisputes(): Dispute[] {
  return [
    {
      id: "PP-D-DEMO-10421",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      stage: "CHARGEBACK",
      amount: { currency_code: "USD", value: "148.00" },
      createdAt: iso(-3),
      sellerResponseDueDate: iso(4),
      transactionId: "5TY05013RG002845M",
      buyerName: "Jordan Mills",
      buyerEmail: "jordan.mills@example.com",
      buyerMessage: "I never got my pour-over set. It's been two weeks.",
      itemDescription: "Pour-over coffee set (dripper, carafe, 2 cups)",
      source: "demo",
    },
    {
      id: "PP-D-DEMO-10433",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      stage: "INQUIRY",
      amount: { currency_code: "USD", value: "64.00" },
      createdAt: iso(-1),
      sellerResponseDueDate: iso(9),
      transactionId: "8KL12298PQ551920T",
      buyerName: "Priya Raman",
      buyerEmail: "priya.r@example.com",
      buyerMessage: "Tracking hasn't moved in 11 days. Where is my order?",
      itemDescription: "Speckled stoneware mug x2",
      source: "demo",
    },
    {
      id: "PP-D-DEMO-10447",
      reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      stage: "INQUIRY",
      amount: { currency_code: "USD", value: "92.00" },
      createdAt: iso(-2),
      sellerResponseDueDate: iso(8),
      transactionId: "3MN77812XZ004411K",
      buyerName: "Sam Okafor",
      buyerEmail: "sam.okafor@example.com",
      buyerMessage: "The glaze colour is much darker than the photos. Not what I ordered.",
      itemDescription: "Ocean-glaze serving bowl (large)",
      source: "demo",
    },
    {
      id: "PP-D-DEMO-10452",
      reason: "UNAUTHORISED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      stage: "CHARGEBACK",
      amount: { currency_code: "USD", value: "236.50" },
      createdAt: iso(-5),
      sellerResponseDueDate: iso(2),
      transactionId: "9AB33019CD778812E",
      buyerName: "Alex Chen",
      buyerEmail: "alex.chen@example.com",
      buyerMessage: "I did not authorise this payment.",
      itemDescription: "Hand-thrown dinnerware set (8 pcs)",
      source: "demo",
    },
    {
      id: "PP-D-DEMO-10460",
      reason: "DUPLICATE_TRANSACTION",
      status: "WAITING_FOR_SELLER_RESPONSE",
      stage: "INQUIRY",
      amount: { currency_code: "USD", value: "38.00" },
      createdAt: iso(-1),
      sellerResponseDueDate: iso(9),
      transactionId: "1QW88213RT660917B",
      buyerName: "Maria Gonzalez",
      buyerEmail: "maria.g@example.com",
      buyerMessage: "I was charged twice for the same thing.",
      itemDescription: "Ceramic coffee filter cone",
      source: "demo",
    },
    {
      id: "PP-D-DEMO-10468",
      reason: "CREDIT_NOT_PROCESSED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      stage: "CHARGEBACK",
      amount: { currency_code: "USD", value: "54.00" },
      createdAt: iso(-4),
      sellerResponseDueDate: iso(3),
      transactionId: "6HJ45520LK093318S",
      buyerName: "Tom Becker",
      buyerEmail: "tom.becker@example.com",
      buyerMessage: "I returned the item but never got my refund.",
      itemDescription: "Matte black espresso cups x4",
      source: "demo",
    },
    {
      id: "PP-D-DEMO-10471",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      stage: "INQUIRY",
      amount: { currency_code: "USD", value: "12.00" },
      createdAt: iso(-1),
      sellerResponseDueDate: iso(9),
      transactionId: "2ZX90017VB224455N",
      buyerName: "Lena Fischer",
      buyerEmail: "lena.f@example.com",
      buyerMessage: "Never arrived.",
      itemDescription: "Linen coaster pack (letter mail, untracked)",
      source: "demo",
    },
  ];
}

/** Shipment tracking as PayPal's tracking API would return it (keyed by transaction id). */
export const demoTracking: Record<string, unknown> = {
  "5TY05013RG002845M": {
    carrier: "UPS",
    tracking_number: "1Z999AA10123456784",
    status: "DELIVERED",
    events: [
      { at: "shipped", detail: "Label created, picked up - Portland, OR" },
      { at: "in_transit", detail: "Departed facility - Denver, CO" },
      { at: "delivered", detail: "Delivered - front door. Signed by: J MILLS" },
    ],
    shipping_address_matches_paypal: true,
    signature_on_delivery: true,
  },
  "8KL12298PQ551920T": {
    carrier: "USPS",
    tracking_number: "9400111899223857264839",
    status: "IN_TRANSIT",
    events: [
      { at: "shipped", detail: "Accepted at USPS origin facility - Portland, OR" },
      { at: "in_transit", detail: "In transit to next facility (no update for 11 days)" },
    ],
    shipping_address_matches_paypal: true,
    signature_on_delivery: false,
  },
  "3MN77812XZ004411K": {
    carrier: "FedEx",
    tracking_number: "771234567890",
    status: "DELIVERED",
    events: [{ at: "delivered", detail: "Delivered - left at front desk" }],
    shipping_address_matches_paypal: true,
    signature_on_delivery: false,
  },
  "9AB33019CD778812E": {
    carrier: "UPS",
    tracking_number: "1Z999AA10198765432",
    status: "DELIVERED",
    events: [{ at: "delivered", detail: "Delivered - residential. Signed by: A CHEN" }],
    shipping_address_matches_paypal: true,
    signature_on_delivery: true,
  },
  "6HJ45520LK093318S": {
    carrier: "USPS",
    tracking_number: "9400111899223800011122",
    status: "DELIVERED",
    events: [{ at: "delivered", detail: "Delivered to buyer" }],
    shipping_address_matches_paypal: true,
    signature_on_delivery: false,
  },
};

/**
 * The merchant's own records - the "evidence locker". PayPal doesn't hold any of
 * this: order notes, support chats, store policies, device fingerprints. This is
 * what a small merchant would otherwise have to dig up by hand.
 */
export type MerchantRecord = {
  transactionId: string;
  orderId: string;
  customerEmail: string;
  orderedAt: string;
  items: string[];
  shippingAddress: string;
  notes: string[];
  supportThread: { from: "customer" | "merchant"; text: string; at: string }[];
  device?: { ip: string; fingerprint: string; avsMatch: boolean; cvvMatch?: boolean };
  refunds?: { refundId: string; amount: string; at: string; status: string }[];
  productListing?: { title: string; disclaimer?: string; photosCount: number };
};

export const demoMerchantRecords: MerchantRecord[] = [
  {
    transactionId: "5TY05013RG002845M",
    orderId: "KK-2291",
    customerEmail: "jordan.mills@example.com",
    orderedAt: "16 days ago",
    items: ["Pour-over coffee set"],
    shippingAddress: "412 Alder St, Boulder, CO 80302",
    notes: ["Shipped next business day", "Signature required (order > $100 policy)"],
    supportThread: [],
  },
  {
    transactionId: "8KL12298PQ551920T",
    orderId: "KK-2307",
    customerEmail: "priya.r@example.com",
    orderedAt: "13 days ago",
    items: ["Speckled stoneware mug", "Speckled stoneware mug"],
    shippingAddress: "88 Lake Shore Dr, Chicago, IL 60601",
    notes: ["USPS Ground Advantage, no insurance purchased"],
    supportThread: [
      { from: "customer", text: "Hi, my tracking hasn't updated in a week?", at: "4 days ago" },
    ],
  },
  {
    transactionId: "3MN77812XZ004411K",
    orderId: "KK-2311",
    customerEmail: "sam.okafor@example.com",
    orderedAt: "9 days ago",
    items: ["Ocean-glaze serving bowl (large)"],
    shippingAddress: "19 Cedar Ave, Austin, TX 78701",
    notes: ["Each piece is hand-glazed; colour varies batch to batch"],
    supportThread: [
      { from: "customer", text: "The bowl is way darker than the website photo.", at: "3 days ago" },
      {
        from: "merchant",
        text: "Sorry about that! Glazes vary by kiln firing. Happy to do a free return or a 30% partial refund if you'd like to keep it.",
        at: "3 days ago",
      },
    ],
    productListing: {
      title: "Ocean-glaze serving bowl",
      disclaimer: "Handmade: glaze colour and pattern will vary from the photos.",
      photosCount: 4,
    },
  },
  {
    transactionId: "9AB33019CD778812E",
    orderId: "KK-2275",
    customerEmail: "alex.chen@example.com",
    orderedAt: "21 days ago",
    items: ["Hand-thrown dinnerware set (8 pcs)"],
    shippingAddress: "7 Maple Ct, Seattle, WA 98101",
    notes: ["Returning customer: 4 prior orders to the same address since 2025, none disputed"],
    supportThread: [
      { from: "customer", text: "Any chance this ships before Friday? It's a gift.", at: "21 days ago" },
      { from: "merchant", text: "Yes, shipping tomorrow!", at: "21 days ago" },
    ],
    device: { ip: "73.22.140.9", fingerprint: "fp_8c1e...a91", avsMatch: true, cvvMatch: true },
  },
  {
    transactionId: "1QW88213RT660917B",
    orderId: "KK-2320",
    customerEmail: "maria.g@example.com",
    orderedAt: "6 days ago",
    items: ["Ceramic coffee filter cone"],
    shippingAddress: "300 Pine St, San Francisco, CA 94104",
    notes: [
      "Customer placed TWO separate orders: KK-2318 (transaction 4RT55102MN339021A, gift-wrapped, shipped to a different address) and KK-2320 (this one)",
      "Both orders shipped and delivered",
    ],
    supportThread: [],
  },
  {
    transactionId: "6HJ45520LK093318S",
    orderId: "KK-2260",
    customerEmail: "tom.becker@example.com",
    orderedAt: "30 days ago",
    items: ["Matte black espresso cups x4"],
    shippingAddress: "55 Elm St, Denver, CO 80203",
    notes: ["Return received at warehouse 12 days ago"],
    supportThread: [
      { from: "merchant", text: "Got your return - refund issued today, should land in 3-5 days.", at: "11 days ago" },
    ],
    refunds: [{ refundId: "1JU08902KD555432F", amount: "54.00", at: "11 days ago", status: "COMPLETED" }],
  },
  {
    transactionId: "2ZX90017VB224455N",
    orderId: "KK-2322",
    customerEmail: "lena.f@example.com",
    orderedAt: "15 days ago",
    items: ["Linen coaster pack"],
    shippingAddress: "Rue 4, Lyon, FR",
    notes: ["Sent by untracked letter mail to keep shipping cost low"],
    supportThread: [],
  },
];

export const storePolicies = {
  shipping:
    "Orders ship within 1 business day. Orders over $100 ship with signature confirmation. Low-value items may ship untracked.",
  returns:
    "30-day returns on unused items. Refunds issued within 2 business days of the return arriving.",
  handmade:
    "All pieces are handmade. Glaze colour, texture and size vary slightly from the photos; this is stated on every listing.",
};
