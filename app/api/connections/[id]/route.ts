import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser, canEdit } from "@/lib/auth";

/** Exclui uma conexão: credenciais, dados sincronizados e DataAssets vinculados. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!canEdit(user.papel)) {
    return NextResponse.json({ error: "Seu papel (viewer) não permite excluir conexões." }, { status: 403 });
  }
  const db = getDb();
  const conn = db.prepare("SELECT id, nome, tipo, config FROM connections WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; nome: string; tipo: string; config: string }
    | undefined;
  if (!conn) return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  if (JSON.parse(conn.config ?? "{}").demo) {
    return NextResponse.json({ error: "As conexões demo não podem ser excluídas (são a base do ambiente de demonstração)." }, { status: 400 });
  }

  const sourceTables: Record<string, string[]> = {
    vtex: ["vtex_orders", "vtex_products"],
    zendesk: ["zendesk_tickets"],
    powerbi: ["powerbi_reports"],
    ads: ["marketing_campaigns"],
    supabase: ["raw_records"],
  };
  for (const t of sourceTables[conn.tipo] ?? []) db.prepare(`DELETE FROM ${t} WHERE connection_id = ?`).run(conn.id);
  const assets = db.prepare("SELECT id FROM data_assets WHERE connection_id = ?").all(conn.id) as { id: number }[];
  for (const a of assets) {
    db.prepare("DELETE FROM asset_relationships WHERE asset_origem_id = ? OR asset_destino_id = ?").run(a.id, a.id);
  }
  db.prepare("DELETE FROM data_assets WHERE connection_id = ?").run(conn.id);
  db.prepare("DELETE FROM credentials WHERE connection_id = ?").run(conn.id);
  db.prepare("DELETE FROM connections WHERE id = ?").run(conn.id);

  audit(user.nome, "connection.delete", conn.nome, "Conexão, credenciais, dados sincronizados e ativos do catálogo removidos.");
  return NextResponse.json({ ok: true });
}
