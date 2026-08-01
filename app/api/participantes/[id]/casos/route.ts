import { NextResponse } from "next/server";
import { getParticipant, createCase, listCasesByParticipant, type ClinicalCaseInput } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const participantId = Number(id);
  if (user.papel !== "mentora" && user.participantId !== participantId) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }
  return NextResponse.json(await listCasesByParticipant(participantId));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const participantId = Number(id);
  if (user.papel !== "mentora" && user.participantId !== participantId) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }
  const participante = await getParticipant(participantId);
  if (!participante) return NextResponse.json({ error: "Participante não encontrada." }, { status: 404 });

  const body = (await req.json()) as Partial<ClinicalCaseInput>;
  if (!body.nome?.trim()) return NextResponse.json({ error: "Informe um identificador para o caso (nome ou iniciais)." }, { status: 400 });

  const idade = body.idade === null || body.idade === undefined || (body.idade as unknown as string) === "" ? null : Number(body.idade);
  if (idade !== null && (!Number.isInteger(idade) || idade < 0 || idade > 120)) {
    return NextResponse.json({ error: "Idade inválida." }, { status: 400 });
  }

  const id2 = await createCase(participantId, {
    nome: body.nome,
    idade,
    diagnosticoPreliminar: body.diagnosticoPreliminar ?? "",
    escolaSerie: body.escolaSerie ?? "",
    responsavelNome: body.responsavelNome ?? "",
    responsavelContato: body.responsavelContato ?? "",
    queixaPrincipal: body.queixaPrincipal ?? "",
    objetivo: body.objetivo ?? "",
    observacoes: body.observacoes ?? "",
  });
  return NextResponse.json({ ok: true, id: id2 });
}
