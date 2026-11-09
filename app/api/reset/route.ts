import { NextResponse } from "next/server";
import { store } from "@/lib/data/store";

/** Clears analyses and resolutions so the demo can be replayed. */
export async function POST() {
  store.reset();
  return NextResponse.json({ ok: true });
}
