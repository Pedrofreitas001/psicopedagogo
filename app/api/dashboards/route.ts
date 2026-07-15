import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const db = getDb();
  return NextResponse.json(db.prepare("SELECT * FROM dashboards WHERE workspace_id = 1 ORDER BY id DESC").all());
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const body = await req.json();
  if (!body.titulo?.trim() || !body.spec_json) {
    return NextResponse.json({ error: "titulo e spec_json são obrigatórios" }, { status: 400 });
  }
  const db = getDb();
  const info = db.prepare(
    "INSERT INTO dashboards (workspace_id, titulo, descricao, spec_json, criado_por) VALUES (1, ?, ?, ?, ?)"
  ).run(body.titulo.trim(), body.descricao ?? "", JSON.stringify(body.spec_json), user.nome);
  audit(user.nome, "dashboard.create", body.titulo.trim(), "Dashboard salvo a partir de resposta do assistente.");
  return NextResponse.json({ id: info.lastInsertRowid });
}
