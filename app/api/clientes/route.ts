import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora cadastra clientes." }, { status: 403 });

  const { nome, email, objetivo, observacoes } = (await req.json()) as {
    nome?: string; email?: string; objetivo?: string; observacoes?: string;
  };
  if (!nome?.trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });

  const info = getDb()
    .prepare("INSERT INTO clients (workspace_id, nome, email, objetivo, observacoes) VALUES (1, ?, ?, ?, ?)")
    .run(nome.trim(), (email ?? "").trim().toLowerCase(), objetivo ?? "", observacoes ?? "");
  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) });
}
