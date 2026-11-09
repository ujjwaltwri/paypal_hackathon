/**
 * SANDBOX ONLY. Simulates PayPal asking the seller for evidence, moving a
 * dispute from UNDER_REVIEW to WAITING_FOR_SELLER_RESPONSE.
 *   npm run sandbox:require-evidence -- PP-R-XXX-12345678
 */
import { getDispute, sandboxRequireSellerEvidence } from "../lib/paypal/rest";

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error("Usage: npm run sandbox:require-evidence -- <dispute id>");
  console.log("Before:", (await getDispute(id)).status);
  await sandboxRequireSellerEvidence(id);
  console.log("After: ", (await getDispute(id)).status);
}
main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
