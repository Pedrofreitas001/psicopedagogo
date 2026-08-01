import { NextResponse } from "next/server";
import { getAssignment, getCase, getProtocol, getResponses, saveResponses, updateAssignmentStatus, deleteAssignment, logEvent } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

async function podeAcessarAssignment(user: { papel: string; participantId: number | null }, caseId: number): Promise<boolean> {
  if (user.papel === "mentora") return true;
  const caso = await getCase(caseId);
  return !!caso && caso.participantId === user.participantId;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const assignment = await getAssignment(Number(id));
  if (!assignment) return NextResponse.json({ error: "Aplicação não encontrada." }, { status: 404 });
  if (!(await podeAcessarAssignment(user, assignment.caseId))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  const [protocolo, respostas] = await Promise.all([getProtocol(assignment.protocolId), getResponses(assignment.id)]);
  return NextResponse.json({ assignment, protocolo, respostas });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const assignmentId = Number(id);
  const assignment = await getAssignment(assignmentId);
  if (!assignment) return NextResponse.json({ error: "Aplicação não encontrada." }, { status: 404 });
  if (!(await podeAcessarAssignment(user, assignment.caseId))) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

  const body = (await req.json()) as { respostas?: { fieldId: number; valor: unknown }[]; status?: "em_andamento" | "concluido" };
  if (body.respostas) await saveResponses(assignmentId, body.respostas.map((r) => ({ fieldId: r.fieldId, valor: r.valor as never })));
  if (body.status && body.status !== assignment.status) {
    await updateAssignmentStatus(assignmentId, body.status);
    if (body.status === "concluido") {
      const caso = await getCase(assignment.caseId);
      if (caso) await logEvent(caso.participantId, assignment.caseId, "protocolo", `${user.nome} concluiu o protocolo “${assignment.protocolNome}”.`);
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora exclui protocolos." }, { status: 403 });
  const { id } = await params;
  await deleteAssignment(Number(id));
  return NextResponse.json({ ok: true });
}
