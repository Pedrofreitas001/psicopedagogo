import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * “Explicar com IA” (Módulo 5). No MVP a explicação é gerada por análise
 * determinística do SQL; em produção, este endpoint chama o modelo via
 * Agent SDK com o schema do DataAsset como contexto.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const user = await getCurrentUser();
  const q = db.prepare("SELECT * FROM queries WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; titulo: string; sql: string }
    | undefined;
  if (!q) return NextResponse.json({ error: "Query não encontrada" }, { status: 404 });

  const sql = q.sql.toLowerCase();
  const parts: string[] = [];
  const tabela = sql.match(/from\s+([a-z_]+)/)?.[1];
  if (tabela) parts.push(`Esta query consulta a tabela **${tabela}**`);
  if (sql.includes("group by")) parts.push(`agrupando os resultados por ${sql.match(/group by\s+([a-z_,\s]+?)(having|order|;|$)/)?.[1]?.trim() ?? "uma dimensão"}`);
  if (sql.includes("sum(total)")) parts.push("somando o valor total (receita)");
  if (sql.includes("count(")) parts.push("contando ocorrências");
  if (sql.includes("-30 days")) parts.push("no período dos últimos 30 dias");
  if (sql.includes("!= 'cancelado'")) parts.push("excluindo pedidos cancelados");
  if (sql.includes("status = 'aberto'")) parts.push("considerando apenas registros com status aberto");
  const having = sql.match(/having\s+sum\(total\)\s*>\s*(\d+)/)?.[1];
  if (having) parts.push(`e mantendo apenas quem somou mais de R$${having}`);
  if (sql.includes("order by")) parts.push("com o resultado ordenado do maior para o menor");

  const explicacao = parts.length
    ? parts.join(", ") + "."
    : "Não consegui interpretar o SQL automaticamente — revise a sintaxe.";
  db.prepare("UPDATE queries SET ultima_execucao = datetime('now') WHERE id = ?").run(q.id);
  audit(user.nome, "query.explain", q.titulo, "Explicação gerada pelo assistente.");
  return NextResponse.json({ explicacao });
}
