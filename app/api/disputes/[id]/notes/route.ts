import { NextResponse } from "next/server";
import { store } from "@/lib/data/store";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { note } = (await req.json()) as { note?: string };
  if (!note?.trim()) return NextResponse.json({ error: "Empty note" }, { status: 400 });
  store.addNote(id, note.trim().slice(0, 4000));
  return NextResponse.json({ notes: store.notes(id) });
}
