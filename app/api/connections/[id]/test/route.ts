import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { decrypt } from "@/lib/vault";
import { getCurrentUser } from "@/lib/auth";
import { testVtex, testZendesk, testPowerBi, testSupabase, type TestResult } from "@/lib/connectors";

/** Health-check de uma conexão existente contra a API real. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const user = await getCurrentUser();
  const conn = db.prepare("SELECT * FROM connections WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; tipo: string; nome: string; config: string }
    | undefined;
  if (!conn) return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });

  const config = JSON.parse(conn.config ?? "{}");
  if (config.demo) {
    return NextResponse.json({ ok: true, message: "Conexão demo — sempre saudável. Crie uma conexão real para testar contra a API." });
  }
  const cred = db.prepare("SELECT valor_criptografado FROM credentials WHERE connection_id = ? ORDER BY id DESC LIMIT 1").get(conn.id) as
    | { valor_criptografado: string }
    | undefined;
  if (!cred) return NextResponse.json({ ok: false, message: "Nenhuma credencial cadastrada para esta conexão." });

  const secret = JSON.parse(decrypt(cred.valor_criptografado));
  audit(user.nome, "vault.read", `Credencial ${conn.nome}`, "Leitura para health-check da conexão.");

  let result: TestResult;
  try {
    if (conn.tipo === "vtex") result = await testVtex(config, secret);
    else if (conn.tipo === "zendesk") result = await testZendesk(config, secret);
    else if (conn.tipo === "powerbi") result = await testPowerBi(config, secret);
    else if (conn.tipo === "supabase") result = await testSupabase(config, secret);
    else result = { ok: false, message: `Health-check não implementado para o tipo ${conn.tipo}.` };
  } catch (e) {
    result = { ok: false, message: (e as Error).message };
  }
  db.prepare("UPDATE connections SET status = ? WHERE id = ?").run(result.ok ? "conectado" : "erro", conn.id);
  return NextResponse.json(result);
}
