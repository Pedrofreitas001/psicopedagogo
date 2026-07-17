import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { encrypt } from "@/lib/vault";
import { getCurrentUser, canEdit } from "@/lib/auth";
import { testVtex, testZendesk, testPowerBi, testSupabase, CONNECTOR_FIELDS, type TestResult } from "@/lib/connectors";

/**
 * Cria uma conexão REAL: valida as credenciais contra a API externa,
 * guarda o segredo criptografado no Vault e registra auditoria.
 * O segredo nunca volta na resposta.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canEdit(user.papel)) {
    return NextResponse.json({ error: "Seu papel (viewer) não permite criar conexões." }, { status: 403 });
  }
  const body = await req.json();
  const { tipo, nome, config, secret } = body as {
    tipo: string;
    nome: string;
    config: Record<string, string>;
    secret: Record<string, string>;
  };
  if (!CONNECTOR_FIELDS[tipo]) return NextResponse.json({ error: `Tipo de conector desconhecido: ${tipo}` }, { status: 400 });
  if (!nome?.trim()) return NextResponse.json({ error: "Dê um nome à conexão." }, { status: 400 });
  for (const f of CONNECTOR_FIELDS[tipo].secret) {
    if (!secret?.[f.key]?.trim()) return NextResponse.json({ error: `Campo obrigatório: ${f.label}` }, { status: 400 });
  }

  // Testa contra a API real antes de salvar
  let test: TestResult;
  try {
    if (tipo === "vtex") test = await testVtex(config as never, secret as never);
    else if (tipo === "zendesk") test = await testZendesk(config as never, secret as never);
    else if (tipo === "supabase") test = await testSupabase(config as never, secret as never);
    else test = await testPowerBi(config as never, secret as never);
  } catch (e) {
    test = { ok: false, message: (e as Error).message };
  }

  const db = getDb();
  const info = db.prepare(
    "INSERT INTO connections (workspace_id, tipo, nome, status, config) VALUES (1, ?, ?, ?, ?)"
  ).run(tipo, nome.trim(), test.ok ? "conectado" : "erro", JSON.stringify({ ...config, demo: false }));
  const connectionId = Number(info.lastInsertRowid);

  const credTipo =
    tipo === "vtex" ? "api_key"
    : tipo === "zendesk" ? (config.authType === "api_token" ? "api_token" : "oauth")
    : tipo === "supabase" ? "api_key"
    : "service_principal";
  db.prepare("INSERT INTO credentials (connection_id, tipo, valor_criptografado, escopo) VALUES (?, ?, ?, ?)").run(
    connectionId, credTipo, encrypt(JSON.stringify(secret)), "leitura"
  );

  audit(user.nome, "connection.create", nome.trim(), `Tipo ${tipo}; teste de credencial: ${test.ok ? "OK" : `falhou (${test.message})`}.`);
  return NextResponse.json({ id: connectionId, test });
}
