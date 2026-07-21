import { NextResponse } from "next/server";
import { createKnowledge, updateKnowledge, deleteKnowledge } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

async function soMentora() {
  const user = await getCurrentUser();
  return user && user.papel === "mentora" ? user : null;
}

export async function POST(req: Request) {
  if (!(await soMentora())) return NextResponse.json({ error: "Apenas a mentora edita a metodologia." }, { status: 403 });
  const { titulo, conteudo } = (await req.json()) as { titulo?: string; conteudo?: string };
  if (!titulo?.trim() || !conteudo?.trim()) return NextResponse.json({ error: "Informe título e conteúdo." }, { status: 400 });
  const id = await createKnowledge(titulo.trim(), conteudo.trim());
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  if (!(await soMentora())) return NextResponse.json({ error: "Apenas a mentora edita a metodologia." }, { status: 403 });
  const { id, titulo, conteudo } = (await req.json()) as { id?: number; titulo?: string; conteudo?: string };
  if (!id || !titulo?.trim() || !conteudo?.trim()) return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  await updateKnowledge(id, titulo.trim(), conteudo.trim());
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await soMentora())) return NextResponse.json({ error: "Apenas a mentora edita a metodologia." }, { status: 403 });
  const { id } = (await req.json()) as { id?: number };
  if (!id) return NextResponse.json({ error: "Informe o id." }, { status: 400 });
  await deleteKnowledge(id);
  return NextResponse.json({ ok: true });
}
