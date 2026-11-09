import { NextResponse } from "next/server";
import { getModel } from "@/lib/agent/model";
import { hasPayPalCreds, getAccessToken } from "@/lib/paypal/rest";

export const dynamic = "force-dynamic";

export async function GET() {
  let paypal: { configured: boolean; authOk?: boolean; error?: string } = { configured: hasPayPalCreds() };
  if (paypal.configured) {
    try {
      await getAccessToken();
      paypal.authOk = true;
    } catch (e) {
      paypal = { ...paypal, authOk: false, error: (e as Error).message };
    }
  }
  return NextResponse.json({ paypal, llm: getModel()?.label ?? null });
}
