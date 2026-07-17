import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser, canEdit } from "@/lib/auth";

/** Curadoria do modelo semântico: confirma/corrige papel e nome das colunas. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canEdit(user.papel)) {
    return NextResponse.json({ error: "Seu papel (viewer) não permite editar o modelo semântico." }, { status: 403 });
  }
  const db = getDb();
  const asset = db.prepare("SELECT id, nome FROM data_assets WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; nome: string }
    | undefined;
  if (!asset) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const body = await req.json();
  const columns = (body.columns ?? []) as { coluna: string; papel: string; tipo_dado: string; nome_semantico: string }[];
  const upd = db.prepare(
    "UPDATE asset_columns SET papel = ?, tipo_dado = ?, nome_semantico = ?, confirmado = 1 WHERE asset_id = ? AND coluna = ?"
  );
  for (const c of columns) upd.run(c.papel, c.tipo_dado, c.nome_semantico ?? "", asset.id, c.coluna);
  audit(user.nome, "semantic.curate", asset.nome, `${columns.length} colunas confirmadas no modelo semântico.`);
  return NextResponse.json({ ok: true });
}
