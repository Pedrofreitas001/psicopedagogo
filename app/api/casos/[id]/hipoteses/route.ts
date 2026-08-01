import { NextResponse } from "next/server";
import { getCase, createHypothesis, listHypotheses, logEvent } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const caseId = Number(id);
  const caso = await getCase(caseId);
  if (!caso) return NextResponse.json({ error: "Caso não encontrado." }, { status: 404 });
  if (user.papel !== "mentora" && user.participantId !== caso.participantId) {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }
  return NextResponse.json(await listHypotheses(caseId));
}

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

  const { texto, evidenciasFavor, evidenciasContra } = (await req.json()) as {
    texto?: string;
    evidenciasFavor?: string;
    evidenciasContra?: string;
  };
  if (!texto?.trim()) return NextResponse.json({ error: "Escreva a hipótese." }, { status: 400 });

  const hipoteseId = await createHypothesis({
    caseId,
    texto: texto.trim(),
    evidenciasFavor: evidenciasFavor?.trim() ?? "",
    evidenciasContra: evidenciasContra?.trim() ?? "",
  });
  await logEvent(caso.participantId, caseId, "hipotese", `${user.nome} registrou uma nova hipótese clínica.`);
  return NextResponse.json({ ok: true, id: hipoteseId });
}
