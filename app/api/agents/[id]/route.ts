import { NextResponse } from "next/server";
import { getDb, audit } from "@/lib/db";
import { getCurrentUser, canEdit } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canEdit(user.papel)) {
    return NextResponse.json({ error: "Seu papel (viewer) não permite editar agentes." }, { status: 403 });
  }
  const db = getDb();
  const agent = db.prepare("SELECT id, nome FROM agents WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; nome: string }
    | undefined;
  if (!agent) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });

  const body = await req.json();
  const scalar = ["nome", "objetivo", "prompt_base", "modelo", "escopo_trabalho", "fora_escopo"] as const;
  const changes: string[] = [];
  for (const field of scalar) {
    if (body[field] !== undefined) {
      db.prepare(`UPDATE agents SET ${field} = ? WHERE id = ?`).run(body[field], agent.id);
      changes.push(field);
    }
  }
  for (const field of ["personalidade", "diretrizes", "restricoes"] as const) {
    if (body[field] !== undefined) {
      db.prepare(`UPDATE agents SET ${field} = ? WHERE id = ?`).run(JSON.stringify(body[field]), agent.id);
      changes.push(field);
    }
  }
  if (body.ferramentas !== undefined) {
    db.prepare("UPDATE agents SET ferramentas = ? WHERE id = ?").run(JSON.stringify(body.ferramentas), agent.id);
    changes.push(`ferramentas → [${body.ferramentas.join(", ")}]`);
  }
  if (body.assets_autorizados !== undefined) {
    db.prepare("UPDATE agents SET assets_autorizados = ? WHERE id = ?").run(JSON.stringify(body.assets_autorizados), agent.id);
    changes.push("assets_autorizados");
  }
  if (body.pode_exibir_pii !== undefined) {
    db.prepare("UPDATE agents SET pode_exibir_pii = ? WHERE id = ?").run(body.pode_exibir_pii ? 1 : 0, agent.id);
    changes.push(`pode_exibir_pii → ${body.pode_exibir_pii ? "sim" : "não"}`);
  }
  if (changes.length) audit(user.nome, "agent.update", agent.nome, `Alterações: ${changes.join("; ")}.`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (user.papel !== "admin") {
    return NextResponse.json({ error: "Apenas admin pode excluir agentes." }, { status: 403 });
  }
  const db = getDb();
  const agent = db.prepare("SELECT id, nome FROM agents WHERE id = ? AND workspace_id = 1").get(Number(id)) as
    | { id: number; nome: string }
    | undefined;
  if (!agent) return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  db.prepare("DELETE FROM agents WHERE id = ?").run(agent.id);
  audit(user.nome, "agent.delete", agent.nome);
  return NextResponse.json({ ok: true });
}
