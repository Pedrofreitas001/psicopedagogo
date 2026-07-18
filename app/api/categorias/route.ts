import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora organiza a biblioteca." }, { status: 403 });

  const { nome, parentId } = (await req.json()) as { nome?: string; parentId?: number | null };
  if (!nome?.trim()) return NextResponse.json({ error: "Dê um nome à pasta." }, { status: 400 });

  const db = getDb();
  if (parentId && !db.prepare("SELECT id FROM categories WHERE id = ? AND workspace_id = 1").get(parentId)) {
    return NextResponse.json({ error: "Pasta de destino não encontrada." }, { status: 404 });
  }
  const info = db
    .prepare("INSERT INTO categories (workspace_id, nome, parent_id) VALUES (1, ?, ?)")
    .run(nome.trim().slice(0, 60), parentId ?? null);
  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) });
}
