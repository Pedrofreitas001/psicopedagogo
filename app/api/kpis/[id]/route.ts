import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser, canEdit } from "@/lib/auth";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!canEdit(user.papel)) {
    return NextResponse.json({ error: "Seu papel (viewer) não permite excluir KPIs." }, { status: 403 });
  }
  const db = getDb();
  const kpi = db.prepare("SELECT id, nome FROM kpis WHERE id = ? AND workspace_id = 1").get(Number(id)) as { id: number; nome: string } | undefined;
  if (!kpi) return NextResponse.json({ error: "KPI não encontrado" }, { status: 404 });
  db.prepare("DELETE FROM kpis WHERE id = ?").run(kpi.id);
  audit(user.nome, "kpi.delete", kpi.nome);
  return NextResponse.json({ ok: true });
}
