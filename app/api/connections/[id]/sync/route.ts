import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { decrypt } from "@/lib/vault";
import { getCurrentUser } from "@/lib/auth";
import { syncVtex, syncZendesk, syncPowerBi, upsertAssets } from "@/lib/connectors";

/**
 * sync() do Connection Hub (Módulo 3). Conexões demo recontam os dados
 * semeados; conexões reais chamam a API externa, gravam os dados nas
 * tabelas de origem e criam/atualizam os DataAssets no catálogo.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const user = await getCurrentUser();
  const conn = db.prepare("SELECT * FROM connections WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; tipo: string; nome: string; config: string }
    | undefined;
  if (!conn) return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });

  const config = JSON.parse(conn.config ?? "{}");
  let detalhes: string[] = [];

  if (config.demo) {
    upsertAssets(db, conn.id, conn.tipo);
    detalhes = ["Modo demo: contagens do catálogo atualizadas a partir dos dados semeados."];
  } else {
    const cred = db.prepare("SELECT valor_criptografado FROM credentials WHERE connection_id = ? ORDER BY id DESC LIMIT 1").get(conn.id) as
      | { valor_criptografado: string }
      | undefined;
    if (!cred) return NextResponse.json({ error: "Nenhuma credencial cadastrada para esta conexão." }, { status: 400 });
    const secret = JSON.parse(decrypt(cred.valor_criptografado));
    audit(user.nome, "vault.read", `Credencial ${conn.nome}`, "Leitura para sincronização da conexão.");

    try {
      if (conn.tipo === "vtex") detalhes = (await syncVtex(db, conn.id, config, secret)).detalhes;
      else if (conn.tipo === "zendesk") detalhes = (await syncZendesk(db, conn.id, config, secret)).detalhes;
      else if (conn.tipo === "powerbi") detalhes = (await syncPowerBi(db, conn.id, config, secret)).detalhes;
      else return NextResponse.json({ error: `Sync não implementado para o tipo ${conn.tipo}.` }, { status: 400 });
    } catch (e) {
      const msg = (e as Error).message;
      db.prepare("UPDATE connections SET status = 'erro' WHERE id = ?").run(conn.id);
      audit(user.nome, "connector.sync", conn.nome, `Sincronização FALHOU: ${msg}`);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    upsertAssets(db, conn.id, conn.tipo);
  }

  db.prepare("UPDATE connections SET status = 'conectado', ultima_sincronizacao = datetime('now') WHERE id = ?").run(conn.id);
  audit(user.nome, "connector.sync", conn.nome, `Sincronização concluída — ${detalhes.join("; ")}`);
  return NextResponse.json({ ok: true, detalhes });
}
