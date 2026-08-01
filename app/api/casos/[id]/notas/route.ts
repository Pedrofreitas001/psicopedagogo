import { NextResponse } from "next/server";
import { getCase, createCaseNote, logEvent } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const caseId = Number(id);
  const caso = await getCase(caseId);
  if (!caso) return NextResponse.json({ error: "Caso não encontrado." }, { status: 404 });
  if (user.papel !== "mentora" && user.participantId !== caso.participantId) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }

  const { dataSessao, conteudo } = (await req.json()) as { dataSessao?: string; conteudo?: string };
  if (!conteudo?.trim()) return NextResponse.json({ error: "Escreva o registro do raciocínio clínico." }, { status: 400 });
  const data = dataSessao?.trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: "Data inválida." }, { status: 400 });

  const noteId = await createCaseNote({ caseId, dataSessao: data, conteudo: conteudo.trim(), criadoPor: user.nome });
  await logEvent(caso.participantId, caseId, "sessao", `${user.nome} registrou um raciocínio clínico (${data.split("-").reverse().join("/")}).`);
  return NextResponse.json({ ok: true, id: noteId });
}
