import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser, canEdit } from "@/lib/auth";

export async function GET() {
  const db = getDb();
  const agents = db.prepare("SELECT * FROM agents WHERE workspace_id = 1 ORDER BY id").all();
  return NextResponse.json(agents);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canEdit(user.papel)) {
    return NextResponse.json({ error: "Seu papel (viewer) não permite criar agentes." }, { status: 403 });
  }
  const body = await req.json();
  if (!body.nome?.trim()) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  const db = getDb();
  const info = db.prepare(
    `INSERT INTO agents (workspace_id, nome, objetivo, prompt_base, modelo, ferramentas, assets_autorizados, pode_exibir_pii,
                         personalidade, escopo_trabalho, fora_escopo, diretrizes, restricoes)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    body.nome.trim(),
    body.objetivo ?? "",
    body.prompt_base ?? "",
    body.modelo ?? "claude-sonnet-5",
    JSON.stringify(body.ferramentas ?? []),
    JSON.stringify(body.assets_autorizados ?? []),
    body.pode_exibir_pii ? 1 : 0,
    JSON.stringify(body.personalidade ?? {}),
    body.escopo_trabalho ?? "",
    body.fora_escopo ?? "",
    JSON.stringify(body.diretrizes ?? []),
    JSON.stringify(body.restricoes ?? [])
  );
  audit(user.nome, "agent.create", body.nome.trim(), `Ferramentas: ${(body.ferramentas ?? []).join(", ") || "nenhuma"}.`);
  return NextResponse.json({ id: info.lastInsertRowid });
}
