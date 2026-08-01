import { NextResponse } from "next/server";
import { getCase, getProtocol, createAssignment, listCaseAssignments, logEvent } from "@/lib/data";
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
  return NextResponse.json(await listCaseAssignments(caseId));
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

  const { protocolId, dataAplicacao } = (await req.json()) as { protocolId?: number; dataAplicacao?: string };
  if (!protocolId) return NextResponse.json({ error: "Selecione um protocolo." }, { status: 400 });
  const protocolo = await getProtocol(Number(protocolId));
  if (!protocolo) return NextResponse.json({ error: "Protocolo não encontrado." }, { status: 404 });

  const data = dataAplicacao?.trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: "Data inválida." }, { status: 400 });

  const assignmentId = await createAssignment({ caseId, protocolId: protocolo.id, dataAplicacao: data, criadoPor: user.nome });
  await logEvent(caso.participantId, caseId, "protocolo", `${user.nome} associou o protocolo “${protocolo.nome}” (${data.split("-").reverse().join("/")}).`);
  return NextResponse.json({ ok: true, id: assignmentId });
}
