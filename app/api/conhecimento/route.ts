import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

async function soMentora() {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") {
    return null;
  }
  return user;
}

export async function POST(req: Request) {
  if (!(await soMentora())) return NextResponse.json({ error: "Apenas a mentora edita a metodologia." }, { status: 403 });
  const { titulo, conteudo } = (await req.json()) as { titulo?: string; conteudo?: string };
  if (!titulo?.trim() || !conteudo?.trim()) return NextResponse.json({ error: "Informe título e conteúdo." }, { status: 400 });
  const info = getDb()
    .prepare("INSERT INTO knowledge (workspace_id, titulo, conteudo) VALUES (1, ?, ?)")
    .run(titulo.trim(), conteudo.trim());
  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) });
}

export async function PATCH(req: Request) {
  if (!(await soMentora())) return NextResponse.json({ error: "Apenas a mentora edita a metodologia." }, { status: 403 });
  const { id, titulo, conteudo } = (await req.json()) as { id?: number; titulo?: string; conteudo?: string };
  if (!id || !titulo?.trim() || !conteudo?.trim()) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  getDb()
    .prepare("UPDATE knowledge SET titulo = ?, conteudo = ?, atualizado_em = datetime('now') WHERE id = ? AND workspace_id = 1")
    .run(titulo.trim(), conteudo.trim(), id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await soMentora())) return NextResponse.json({ error: "Apenas a mentora edita a metodologia." }, { status: 403 });
  const { id } = (await req.json()) as { id?: number };
  if (!id) return NextResponse.json({ error: "Informe o id." }, { status: 400 });
  getDb().prepare("DELETE FROM knowledge WHERE id = ? AND workspace_id = 1").run(id);
  return NextResponse.json({ ok: true });
}
