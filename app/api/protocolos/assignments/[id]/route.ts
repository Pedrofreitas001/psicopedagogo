import { NextResponse } from "next/server";
import { getAssignment, getProtocol, getResponses, saveResponses, updateAssignmentStatus, deleteAssignment, logEvent } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora acessa os protocolos." }, { status: 403 });
  const { id } = await params;
  const assignment = await getAssignment(Number(id));
  if (!assignment) return NextResponse.json({ error: "Aplicação não encontrada." }, { status: 404 });
  const [protocolo, respostas] = await Promise.all([getProtocol(assignment.protocolId), getResponses(assignment.id)]);
  return NextResponse.json({ assignment, protocolo, respostas });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.papel !== "mentora") return NextResponse.json({ error: "Apenas a mentora preenche protocolos." }, { status: 403 });
  const { id } = await params;
  const assignmentId = Number(id);
  const assignment = await getAssignment(assignmentId);
  if (!assignment) return NextResponse.json({ error: "Aplicação não encontrada." }, { status: 404 });

  const body = (await req.json()) as { respostas?: { fieldId: number; valor: unknown }[]; status?: "em_andamento" | "concluido" };
  if (body.respostas) await saveResponses(assignmentId, body.respostas.map((r) => ({ fieldId: r.fieldId, valor: r.valor as never })));
  if (body.status && body.status !== assignment.status) {
    await updateAssignmentStatus(assignmentId, body.status);
    if (body.status === "concluido") await logEvent(assignment.clientId, "protocolo", `Mentora concluiu o protocolo “${assignment.protocolNome}”.`);
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
