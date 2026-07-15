import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * sync() do Connection Hub (Módulo 3). Em modo demo, reconta os dados de
 * origem, atualiza os DataAssets no catálogo e registra auditoria — o mesmo
 * contrato que o conector real (servidor MCP) cumpriria contra a API externa.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const user = await getCurrentUser();
  const conn = db.prepare("SELECT * FROM connections WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; tipo: string; nome: string }
    | undefined;
  if (!conn) return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });

  const counts: Record<string, { table: string; asset: string }[]> = {
    vtex: [
      { table: "vtex_orders", asset: "Pedidos" },
      { table: "vtex_products", asset: "Produtos" },
    ],
    zendesk: [{ table: "zendesk_tickets", asset: "Tickets" }],
    powerbi: [{ table: "powerbi_reports", asset: "Relatórios Power BI" }],
  };

  const detalhes: string[] = [];
  for (const item of counts[conn.tipo] ?? []) {
    const { qtd } = db.prepare(`SELECT COUNT(*) AS qtd FROM ${item.table} WHERE connection_id = ?`).get(conn.id) as { qtd: number };
    db.prepare("UPDATE data_assets SET linhas = ?, status = 'ativo' WHERE connection_id = ? AND nome = ?").run(qtd, conn.id, item.asset);
    detalhes.push(`${item.asset}: ${qtd} linhas`);
  }
  db.prepare("UPDATE connections SET status = 'conectado', ultima_sincronizacao = datetime('now') WHERE id = ?").run(conn.id);
  audit(user.nome, "connector.sync", conn.nome, `Sincronização manual concluída — ${detalhes.join("; ")}.`);

  return NextResponse.json({ ok: true, detalhes });
}
