import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight endpoint for health checks and keep-alive pings. */
export function GET() {
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
