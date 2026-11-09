/**
 * Quick sanity check for your PayPal sandbox credentials.
 *   npm run check:paypal
 * Prints whether auth works and how many disputes the sandbox merchant has.
 */
import { getAccessToken, listDisputes } from "../lib/paypal/rest";

async function main() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    console.error("✗ PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing from .env.local");
    process.exit(1);
  }
  await getAccessToken();
  console.log("✓ PayPal sandbox auth OK");
  const disputes = await listDisputes();
  console.log(`✓ ${disputes.length} dispute(s) on this sandbox merchant`);
  for (const d of disputes) console.log(`  - ${d.id}  ${d.reason}  ${d.amount.value} ${d.amount.currency_code}  ${d.status}`);
  if (!disputes.length)
    console.log("  (none yet - open one from the sandbox buyer account at sandbox.paypal.com → Resolution Center)");
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
