import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { maskedPreview } from "@/lib/vault";
import { getCurrentUser } from "@/lib/auth";

/**
 * Acesso auditado a uma credencial do Vault (Módulo 2). O valor NUNCA sai
 * em texto puro pela API — apenas um preview mascarado; toda leitura gera
 * AuditLog consultável.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (user.papel === "viewer") {
    return NextResponse.json({ error: "Apenas admin/steward podem acessar credenciais." }, { status: 403 });
  }
  const cred = db.prepare(
    `SELECT cr.id, cr.tipo, cr.valor_criptografado, cr.escopo, c.nome AS conexao
     FROM credentials cr JOIN connections c ON c.id = cr.connection_id
     WHERE cr.id = ? AND c.workspace_id = 1`
  ).get(Number(id)) as { id: number; tipo: string; valor_criptografado: string; escopo: string; conexao: string } | undefined;
  if (!cred) return NextResponse.json({ error: "Credencial não encontrada" }, { status: 404 });

  audit(user.nome, "vault.read", `Credencial ${cred.conexao} (${cred.tipo})`, "Leitura auditada via API — valor exibido mascarado.");
  return NextResponse.json({ preview: maskedPreview(cred.valor_criptografado), escopo: cred.escopo });
}
