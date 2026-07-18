import { NextResponse } from "next/server";
import { getDb, logEvent } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora edita clientes." }, { status: 403 });

  const { id } = await params;
  const db = getDb();
  const atual = db.prepare("SELECT id, observacoes FROM clients WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; observacoes: string }
    | undefined;
  if (!atual) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const { nome, email, objetivo, observacoes } = (await req.json()) as {
    nome?: string; email?: string; objetivo?: string; observacoes?: string;
  };
  if (!nome?.trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });

  db.prepare("UPDATE clients SET nome = ?, email = ?, objetivo = ?, observacoes = ? WHERE id = ?").run(
    nome.trim(), (email ?? "").trim().toLowerCase(), objetivo ?? "", observacoes ?? "", atual.id
  );
  if ((observacoes ?? "") !== atual.observacoes) {
    logEvent(atual.id, "observacao", "Mentora atualizou as observações do acompanhamento.");
  }
  return NextResponse.json({ ok: true });
}
