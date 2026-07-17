import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { profileAsset, suggestKpis } from "@/lib/semantic";
import { getCurrentUser } from "@/lib/auth";

/** Roda o profiler semântico sobre a amostra do ativo (Layer 1 → Layer 2). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const asset = db.prepare("SELECT id, nome FROM data_assets WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; nome: string }
    | undefined;
  if (!asset) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const columns = profileAsset(asset.id);
  const sugestoes = suggestKpis(asset.id, asset.nome);
  audit(user.nome, "semantic.profile", asset.nome, `${columns.length} colunas perfiladas; ${sugestoes.length} KPIs sugeridos.`);
  return NextResponse.json({ columns, sugestoes });
}
