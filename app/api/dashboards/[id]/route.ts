import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser, canEdit } from "@/lib/auth";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!canEdit(user.papel)) {
    return NextResponse.json({ error: "Seu papel (viewer) não permite excluir dashboards." }, { status: 403 });
  }
  const db = getDb();
  const dash = db.prepare("SELECT id, titulo FROM dashboards WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; titulo: string }
    | undefined;
  if (!dash) return NextResponse.json({ error: "Dashboard não encontrado" }, { status: 404 });
  db.prepare("DELETE FROM dashboards WHERE id = ?").run(dash.id);
  audit(user.nome, "dashboard.delete", dash.titulo);
  return NextResponse.json({ ok: true });
}
