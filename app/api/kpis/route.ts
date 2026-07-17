import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser, canEdit } from "@/lib/auth";

export async function GET() {
  return NextResponse.json(getDb().prepare("SELECT * FROM kpis WHERE workspace_id = 1 ORDER BY id").all());
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!canEdit(user.papel)) {
    return NextResponse.json({ error: "Seu papel (viewer) não permite criar KPIs." }, { status: 403 });
  }
  const body = await req.json();
  if (!body.nome?.trim() || !body.asset_id || !body.agregacao) {
    return NextResponse.json({ error: "nome, asset_id e agregacao são obrigatórios" }, { status: 400 });
  }
  if (body.agregacao !== "count" && !body.coluna_medida) {
    return NextResponse.json({ error: "Escolha a coluna de medida (ou use a agregação 'count')." }, { status: 400 });
  }
  const db = getDb();
  const info = db.prepare(
    `INSERT INTO kpis (workspace_id, nome, descricao, asset_id, agregacao, coluna_medida, coluna_data, coluna_dimensao, formato, criado_por)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    body.nome.trim(),
    body.descricao ?? "",
    Number(body.asset_id),
    body.agregacao,
    body.coluna_medida || null,
    body.coluna_data || null,
    body.coluna_dimensao || null,
    body.formato ?? "numero",
    user.nome
  );
  audit(user.nome, "kpi.create", body.nome.trim(), `Sobre o ativo #${body.asset_id} (${body.agregacao}${body.coluna_medida ? ` de ${body.coluna_medida}` : ""}).`);
  return NextResponse.json({ id: info.lastInsertRowid });
}
