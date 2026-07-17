import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser, canEdit } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canEdit(user.papel)) {
    return NextResponse.json(
      { error: "Seu papel (viewer) não permite editar ativos do catálogo. Peça a um admin ou steward." },
      { status: 403 }
    );
  }
  const db = getDb();
  const asset = db.prepare("SELECT id, nome FROM data_assets WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; nome: string }
    | undefined;
  if (!asset) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const body = await req.json();
  const allowed = ["nome", "descricao", "area", "sensibilidade_lgpd", "campos_sensiveis", "owner_id", "steward_id"] as const;
  const changes: string[] = [];
  for (const field of allowed) {
    if (body[field] !== undefined) {
      const value = field === "campos_sensiveis" ? JSON.stringify(body[field]) : body[field];
      db.prepare(`UPDATE data_assets SET ${field} = ? WHERE id = ?`).run(value, asset.id);
      changes.push(field);
    }
  }
  if (changes.length) {
    const acao = changes.includes("owner_id") || changes.includes("steward_id") ? "catalog.ownership" : "catalog.update";
    audit(user.nome, acao, asset.nome, `Campos alterados: ${changes.join(", ")}.`);
  }
  return NextResponse.json({ ok: true });
}
